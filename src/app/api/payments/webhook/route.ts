import { NextResponse } from "next/server";
import { payments, bills, notifications, bookings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { db, ownerDb } from "@/lib/db";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { getPaymentProvider, amountToPaise } from "@/lib/payments/provider";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || req.headers.get("X-Razorpay-Signature") || "";

  const provider = getPaymentProvider();
  try {
    const isValid = provider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Webhook verification failed" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = String(payload.event || payload.entity || "");

  // Robust payload field extraction
  let razorpayOrderId: string | null = null;
  let razorpayPaymentId: string | null = null;
  let amount: number | null = null;
  let currency: string | null = null;

  if (payload.payload?.payment?.entity) {
    razorpayPaymentId = payload.payload.payment.entity.id;
    razorpayOrderId = payload.payload.payment.entity.order_id;
    amount = payload.payload.payment.entity.amount;
    currency = payload.payload.payment.entity.currency;
  } else if (payload.payload?.order?.entity) {
    razorpayOrderId = payload.payload.order.entity.id;
    amount = payload.payload.order.entity.amount;
    currency = payload.payload.order.entity.currency;
  } else {
    razorpayOrderId = payload.razorpay_order_id || payload.order_id || null;
    razorpayPaymentId = payload.razorpay_payment_id || payload.payment_id || null;
  }

  if (!razorpayOrderId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  // Handle payment.failed event explicitly
  if (event === "payment.failed") {
    try {
      const [payment] = await ownerDb.select().from(payments).where(eq(payments.gatewayRef, razorpayOrderId));
      if (payment && payment.status === "PENDING") {
        await ownerDb.update(payments).set({
          status: "FAILED",
          rawPayload: { ...(payment.rawPayload as any), webhookEvent: event, failureReason: payload.payload?.payment?.entity?.error_description || "Payment failed at gateway", webhookVerifiedAt: new Date().toISOString() },
        }).where(eq(payments.id, payment.id));
        await audit({ actorId: payment.payerId, societyId: payment.societyId, action: "payment:webhook_failed", entity: "payment", entityId: payment.id, newState: { gatewayRef: razorpayOrderId, status: "FAILED" } });
      }
      return NextResponse.json({ received: true, status: "FAILED" });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Failed to record payment failure" }, { status: 500 });
    }
  }

  // Only allow payment.captured or order.paid to settle invoices
  if (event !== "payment.captured" && event !== "order.paid") {
    return NextResponse.json({ received: true, ignored: event });
  }

  try {
    const [payment] = await ownerDb.select().from(payments).where(eq(payments.gatewayRef, razorpayOrderId));
    if (!payment) {
      return NextResponse.json({ error: "Payment not found for order" }, { status: 404 });
    }

    if (payment.status === "SUCCESS") {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }
    if (payment.status !== "PENDING") {
      return NextResponse.json({ error: `Invalid payment status ${payment.status}` }, { status: 400 });
    }

    const societyId = payment.societyId;

    const result = await withTenant(societyId, payment.payerId, async (tx) => {
      const [lockedPay] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.id, payment.id), eq(payments.societyId, societyId)))
        .for("update");
      if (!lockedPay) throw new Error("Payment not found");
      if (lockedPay.status === "SUCCESS") {
        return { payment: lockedPay, bill: null, alreadySuccess: true };
      }
      if (lockedPay.status !== "PENDING") {
        throw new Error(`Invalid payment status ${lockedPay.status}`);
      }

      const [bill] = await tx.select().from(bills).where(and(eq(bills.id, lockedPay.billId!), eq(bills.societyId, societyId)));
      if (!bill) throw new Error("Bill not found");

      const expectedPaise = amountToPaise(lockedPay.amount);
      if (amount !== null) {
        if (amount !== expectedPaise) throw new Error("Amount mismatch");
      }
      const storedOrderPaise = (lockedPay.rawPayload as any)?.amountPaise;
      if (storedOrderPaise !== undefined && storedOrderPaise !== expectedPaise) throw new Error("Order amount mismatch");
      const allSuccessForCheck = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.status, "SUCCESS")));
      const alreadyPaidPaise = allSuccessForCheck.reduce((sum, p) => sum + amountToPaise(p.amount), 0);
      const totalPaiseCheck = amountToPaise(bill.total);
      const outstandingCheck = totalPaiseCheck - alreadyPaidPaise;
      if (expectedPaise > outstandingCheck) throw new Error("Amount exceeds outstanding");

      const [updatedPayment] = await tx.update(payments).set({
        status: "SUCCESS",
        rawPayload: { ...(lockedPay.rawPayload as any), webhookEvent: event, razorpay_payment_id: razorpayPaymentId, razorpay_order_id: razorpayOrderId, webhookVerifiedAt: new Date().toISOString() },
      }).where(eq(payments.id, lockedPay.id)).returning();

      const allSuccess = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.status, "SUCCESS")));
      const totalPaise = amountToPaise(bill.total);
      const paidPaise = allSuccess.reduce((sum, p) => sum + amountToPaise(p.amount), 0);
      let newBillStatus: string = bill.status;
      if (paidPaise >= totalPaise) newBillStatus = "PAID";
      else if (paidPaise > 0) newBillStatus = "PARTIAL";

      let updatedBill = bill;
      if (newBillStatus !== bill.status) {
        const [ub] = await tx.update(bills).set({ status: newBillStatus as any }).where(eq(bills.id, bill.id)).returning();
        updatedBill = ub;
      }

      if (newBillStatus === "PAID") {
        const [linkedBooking] = await tx.select().from(bookings).where(and(eq(bookings.billId, bill.id), eq(bookings.societyId, societyId)));
        if (linkedBooking && linkedBooking.status === "PENDING_PAYMENT") {
          await tx.update(bookings).set({ status: "CONFIRMED" }).where(eq(bookings.id, linkedBooking.id));
          await tx.insert(notifications).values({
            societyId,
            userId: linkedBooking.userId,
            title: `Booking confirmed! 🎉`,
            body: `Your amenity booking has been confirmed. Pass is now active.`,
            channel: "IN_APP",
            relatedEntity: "booking",
            relatedId: linkedBooking.id,
          });
        }
      }

      await tx.insert(notifications).values({
        societyId,
        userId: lockedPay.payerId,
        title: `Payment successful: ₹${lockedPay.amount}`,
        body: `Bill ${bill.title} • Ref ${(lockedPay.gatewayRef || "").slice(0,12)}`,
        channel: "IN_APP",
        relatedEntity: "payment",
        relatedId: lockedPay.id,
      });

      return { payment: updatedPayment, bill: updatedBill, alreadySuccess: false };
    });

    if ((result as any).alreadySuccess) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    await audit({ actorId: payment.payerId, societyId: payment.societyId, action: "payment:webhook_success", entity: "payment", entityId: payment.id, newState: { gatewayRef: razorpayOrderId, status: "SUCCESS" } });

    return NextResponse.json({ success: true, payment: (result as any).payment, bill: (result as any).bill });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
