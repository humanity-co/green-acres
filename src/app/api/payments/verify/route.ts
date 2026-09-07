import { NextResponse } from "next/server";
import { payments, bills, notifications, bookings } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { getPaymentProvider, amountToPaise } from "@/lib/payments/provider";

const schema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  paymentId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("payment:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = parsed.data;

    const provider = getPaymentProvider();
    const isValid = provider.verifySignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
    if (!isValid) {
      await withTenant(societyId, sess.userId, async (tx) => {
        const [pay] = await tx.select().from(payments).where(and(eq(payments.gatewayRef, razorpay_order_id), eq(payments.societyId, societyId)));
        if (pay && pay.status === "PENDING") {
          await tx.update(payments).set({ status: "FAILED", rawPayload: { ...pay.rawPayload as any, razorpay_payment_id, error: "Invalid signature" } }).where(eq(payments.id, pay.id));
        }
      });
      await audit({ actorId: sess.userId, societyId, action: "payment:verify_failed", entity: "payment", entityId: paymentId || razorpay_order_id, newState: { reason: "Invalid signature" } });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.gatewayRef, razorpay_order_id), eq(payments.societyId, societyId)))
        .for("update");
      if (!payment) throw new Error("Payment not found");
      if (paymentId && payment.id !== paymentId) throw new Error("Mismatched payment");
      if (payment.status === "SUCCESS") return { payment, bill: null, alreadySuccess: true };
      if (payment.status !== "PENDING") throw new Error(`Invalid transition from ${payment.status}`);

      const [bill] = await tx.select().from(bills).where(and(eq(bills.id, payment.billId!), eq(bills.societyId, societyId)));
      if (!bill) throw new Error("Bill not found");

      const expectedPaise = amountToPaise(payment.amount);
      const storedOrderPaise = (payment.rawPayload as any)?.amountPaise;
      if (storedOrderPaise !== undefined && storedOrderPaise !== expectedPaise) throw new Error("Order amount mismatch");
      const allSuccessForCheck = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.status, "SUCCESS")));
      const alreadyPaidPaise = allSuccessForCheck.reduce((sum, p) => sum + amountToPaise(p.amount), 0);
      const totalPaiseCheck = amountToPaise(bill.total);
      const outstandingCheck = totalPaiseCheck - alreadyPaidPaise;
      if (expectedPaise > outstandingCheck) throw new Error("Amount exceeds outstanding");
      if (expectedPaise <= 0) throw new Error("Invalid amount");

      const [updatedPayment] = await tx.update(payments).set({
        status: "SUCCESS",
        rawPayload: { ...(payment.rawPayload as any), razorpay_payment_id, razorpay_order_id, verifiedAt: new Date().toISOString() },
      }).where(eq(payments.id, payment.id)).returning();

      const totalPaise = amountToPaise(bill.total);
      const freshSuccess = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.status, "SUCCESS")));
      const freshPaidPaise = freshSuccess.reduce((sum, p) => sum + amountToPaise(p.amount), 0);
      let newBillStatus: string = bill.status;
      if (freshPaidPaise >= totalPaise) newBillStatus = "PAID";
      else if (freshPaidPaise > 0) newBillStatus = "PARTIAL";
      else newBillStatus = bill.status;

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
        userId: sess.userId,
        title: `Payment successful: ₹${payment.amount}`,
        body: `Bill ${bill.title} • Ref ${(payment.gatewayRef || "").slice(0,12)}`,
        channel: "IN_APP",
        relatedEntity: "payment",
        relatedId: payment.id,
      });

      return { payment: updatedPayment, bill: updatedBill, alreadySuccess: false };
    });

    if ((result as any).alreadySuccess) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    await audit({ actorId: sess.userId, societyId, action: "payment:verify_success", entity: "payment", entityId: (result as any).payment.id, newState: { gatewayRef: razorpay_order_id, status: "SUCCESS" } });
    await audit({ actorId: sess.userId, societyId, action: "bill:status_update", entity: "bill", entityId: (result as any).bill.id, newState: { status: (result as any).bill.status } });

    return NextResponse.json({ success: true, payment: (result as any).payment, bill: (result as any).bill });
  } catch (e: any) {
    if (e.message === "Payment not found" || e.message === "Bill not found") return NextResponse.json({ error: e.message }, { status: 404 });
    if (e.message?.includes("Mismatched") || e.message?.includes("Invalid transition")) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
