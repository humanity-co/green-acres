import { NextResponse } from "next/server";
import { payments, units, unitMembers, bills } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

import { amountToPaise } from "@/lib/payments/provider";
function isDecimal(s:string){ try { const p = amountToPaise(s); return p > 0; } catch { return false; } }

export async function GET() {
  const auth = await requireAuthAndSociety("payment:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
    const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","ACCOUNTANT","SUPER_ADMIN"].includes(r));
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      if (isPrivileged) {
        return tx.select().from(payments).where(eq(payments.societyId, societyId)).orderBy(desc(payments.createdAt)).limit(50);
      } else {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (unitIds.length===0) return [];
        return tx.select().from(payments).where(and(eq(payments.societyId, societyId), inArray(payments.unitId, unitIds))).orderBy(desc(payments.createdAt)).limit(50);
      }
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

const createSchema = z.object({
  billId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  amount: z.string().refine(isDecimal, "Invalid amount"),
  method: z.enum(["UPI","CARD","NETBANKING","CASH","PHONEPE","RAZORPAY"]).optional(),
  gatewayRef: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("payment:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;

    const item = await withTenant(societyId, sess.userId, async (tx)=>{
      const [bill] = await tx.select().from(bills).where(and(eq(bills.id, parsed.data.billId), eq(bills.societyId, societyId)));
      if (!bill) throw new Error("Bill not found");
      const unitId = parsed.data.unitId || bill.unitId;
      const [unit] = await tx.select().from(units).where(and(eq(units.id, unitId), eq(units.societyId, societyId)));
      if (!unit) throw new Error("Unit not in society");
      const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, unitId)));
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","ACCOUNTANT","SUPER_ADMIN"].includes(r));
      if (members.length===0 && !isPrivileged) throw new Error("Not authorized for unit");
      if (bill.unitId!==unitId && !isPrivileged) throw new Error("Bill does not belong to unit");

      const amountStr = parsed.data.amount;
      const billPaise = amountToPaise(bill.total);
      const existing = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.status, "SUCCESS")));
      const paidPaise = existing.reduce((sum,p)=> sum + amountToPaise(p.amount), 0);
      const outstandingPaise = billPaise - paidPaise;
      const amountPaise = amountToPaise(amountStr);
      if (amountPaise > outstandingPaise) throw new Error("Amount exceeds outstanding");

      const gatewayRef = parsed.data.gatewayRef || `mock_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const exists = await tx.select().from(payments).where(eq(payments.gatewayRef, gatewayRef));
      if (exists.length>0) throw new Error("Duplicate gatewayRef");

      const [created] = await tx.insert(payments).values({
        societyId, billId: bill.id, unitId, payerId: sess.userId, amount: amountStr, method: parsed.data.method || "UPI", gateway: "mock", gatewayRef, status: "PENDING",
      }).returning();
      return created;
    });
    await audit({ actorId: sess.userId, societyId, action:"create", entity:"payment", entityId: item.id, newState: { amount: item.amount, gatewayRef: item.gatewayRef } });
    return NextResponse.json(item, { status:201 });
  } catch (e:any) {
    if (e.message==="Bill not found" || e.message==="Unit not in society") return NextResponse.json({ error:e.message }, { status:404 });
    if (e.message==="Not authorized for unit" || e.message==="Bill does not belong to unit") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    if (e.message.includes("outstanding") || e.message.includes("Duplicate")) return NextResponse.json({ error:e.message }, { status:409 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
