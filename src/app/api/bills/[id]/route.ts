import { NextResponse } from "next/server";
import { bills, payments, units, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { amountToPaise } from "@/lib/payments/provider";

import { billItems } from "@/lib/db/schema";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("bill:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx)=>{
      const [bill] = await tx.select().from(bills).where(and(eq(bills.id, id), eq(bills.societyId, societyId)));
      if (!bill) return null;
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","ACCOUNTANT","SUPER_ADMIN"].includes(r));
      if (!isPrivileged) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, bill.unitId)));
        if (members.length===0) throw new Error("Forbidden");
      }
      const [unit] = await tx.select().from(units).where(eq(units.id, bill.unitId));
      const pays = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.societyId, societyId)));
      const items = await tx.select().from(billItems).where(eq(billItems.billId, id));
      const outstanding = (()=> {
        const totalPaise = amountToPaise(bill.total);
        const paidPaise = pays.filter(p=>p.status==="SUCCESS").reduce((sum,p)=> sum + amountToPaise(p.amount), 0);
        return (Math.max(0, totalPaise - paidPaise) / 100).toFixed(2);
      })();
      return { bill, unit, payments: pays, items, outstanding };
    });
    if (!data) return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json(data);
  } catch (e:any) {
    if (e.message==="Forbidden") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    return NextResponse.json({ error:"Failed" }, { status:500 });
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["DRAFT", "ISSUED", "OVERDUE", "PAID", "PARTIAL", "CANCELLED"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("bill:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [bill] = await tx.select().from(bills).where(and(eq(bills.id, id), eq(bills.societyId, societyId)));
      if (!bill) throw new Error("Not found");
      if (bill.status === "PAID") throw new Error("Cannot modify a paid bill");

      const allowed: any = {};
      if (parsed.data.title) allowed.title = parsed.data.title;
      if (parsed.data.dueDate) allowed.dueDate = parsed.data.dueDate as any;
      if (parsed.data.status) {
        if (parsed.data.status === "PAID") throw new Error("Cannot directly mark PAID without payment");
        allowed.status = parsed.data.status;
      }
      if (Object.keys(allowed).length === 0) throw new Error("No updates");
      const [upd] = await tx.update(bills).set(allowed).where(and(eq(bills.id, id), eq(bills.societyId, societyId))).returning();
      return { prev: bill, upd };
    });
    await audit({ actorId: sess.userId, societyId, action:"update", entity:"bill", entityId: id, prevState: updated.prev, newState: updated.upd });
    return NextResponse.json(updated.upd);
  } catch (e:any) {
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    if (e.message==="Forbidden") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
