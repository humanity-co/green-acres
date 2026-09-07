import { NextResponse } from "next/server";
import { bills, payments, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { getPaymentProvider, amountToPaise } from "@/lib/payments/provider";

const schema = z.object({
  billId: z.string().uuid(),
  amount: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("payment:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const gateway = process.env.PAYMENT_GATEWAY || "mock";
    if (gateway === "razorpay" && !keyId) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [bill] = await tx.select().from(bills).where(and(eq(bills.id, parsed.data.billId), eq(bills.societyId, societyId)));
      if (!bill) throw new Error("Bill not found");
      const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, bill.unitId)));
      const roles = await import("@/lib/tenant").then(m => m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r: string) => ["SOCIETY_ADMIN", "ACCOUNTANT", "SUPER_ADMIN"].includes(r));
      if (members.length === 0 && !isPrivileged) throw new Error("Not authorized for bill");

      const billTotal = bill.total;
      const existing = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.status, "SUCCESS")));
      const paidSumPaise = existing.reduce((sum, p) => sum + amountToPaise(p.amount), 0);
      const totalPaise = amountToPaise(billTotal);
      const outstandingPaise = totalPaise - paidSumPaise;
      if (outstandingPaise <= 0) throw new Error("Bill already paid");

      let amountPaise: number;
      let amountStr: string;
      if (parsed.data.amount) {
        amountPaise = amountToPaise(parsed.data.amount);
        amountStr = parsed.data.amount;
        if (amountPaise > outstandingPaise) throw new Error("Amount exceeds outstanding");
        if (amountPaise <= 0) throw new Error("Invalid amount");
      } else {
        amountPaise = outstandingPaise;
        amountStr = (outstandingPaise / 100).toFixed(2);
      }

      const provider = getPaymentProvider();
      const order = await provider.createOrder({
        amountPaise,
        currency: "INR",
        receipt: bill.id,
        notes: { societyId, billId: bill.id, unitId: bill.unitId },
      });

      const gatewayRef = order.id;
      const exists = await tx.select().from(payments).where(eq(payments.gatewayRef, gatewayRef));
      if (exists.length > 0) throw new Error("Duplicate order");

      const [payment] = await tx.insert(payments).values({
        societyId,
        billId: bill.id,
        unitId: bill.unitId,
        payerId: sess.userId,
        amount: amountStr,
        method: "RAZORPAY",
        gateway: gateway === "razorpay" ? "razorpay" : "mock",
        gatewayRef,
        status: "PENDING",
        rawPayload: { razorpayOrderId: order.id, amountPaise, currency: order.currency } as any,
      }).returning();

      return { payment, order, amountPaise, outstandingPaise };
    });

    await audit({ actorId: sess.userId, societyId, action: "payment:order_created", entity: "payment", entityId: result.payment.id, newState: { gatewayRef: result.order.id, amount: result.payment.amount } });

    const safeKeyId = gateway === "razorpay" ? keyId : "mock_key_id";

    return NextResponse.json({
      orderId: result.order.id,
      amount: result.order.amount,
      currency: result.order.currency,
      paymentId: result.payment.id,
      keyId: safeKeyId,
      billId: parsed.data.billId,
    });
  } catch (e: any) {
    if (e.message === "Bill not found") return NextResponse.json({ error: e.message }, { status: 404 });
    if (e.message === "Not authorized for bill") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e.message?.includes("Invalid amount")) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message?.includes("already paid") || e.message?.includes("exceeds outstanding") || e.message?.includes("Duplicate")) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e.message?.includes("Razorpay not configured") || e.message?.includes("not configured")) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
