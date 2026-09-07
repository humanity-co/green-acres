import { NextResponse } from "next/server";
import { visitors, visitorInvites, units, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { randomInt, randomUUID } from "crypto";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { getUserRoles } from "@/lib/tenant";

const schema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(20),
  purpose: z.string().min(1).max(200),
  visitDate: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  unitId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("visitor:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    const { societyId, sess } = auth as any;

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      let unitId = parsed.data.unitId;
      if (!unitId) {
        const myUnits = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        if (!myUnits.length) throw new Error("You are not registered in any unit in this society");
        unitId = myUnits[0].unitId;
      } else {
        const roles = await getUserRoles(sess.userId, societyId);
        const isAdmin = roles.some((r: string) => ["SOCIETY_ADMIN", "SUPER_ADMIN"].includes(r));
        if (!isAdmin) {
          const [myUnit] = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, unitId), eq(unitMembers.societyId, societyId)));
          if (!myUnit) throw new Error("Forbidden: You are not a registered member of this unit");
        }
        const [u] = await tx.select().from(units).where(and(eq(units.id, unitId), eq(units.societyId, societyId)));
        if (!u) throw new Error("Unit not in society");
      }
      const [visitor] = await tx.insert(visitors).values({ name: parsed.data.name, phone: parsed.data.phone, societyId }).returning();
      const code = randomInt(100000, 1000000).toString().slice(0, 4).toUpperCase() + randomInt(10, 99).toString();
      const qrToken = randomUUID().replace(/-/g,"").slice(0,16).toUpperCase();
      const validFrom = parsed.data.validFrom ? new Date(parsed.data.validFrom) : new Date();
      const validTo = parsed.data.validTo ? new Date(parsed.data.validTo) : parsed.data.visitDate ? new Date(parsed.data.visitDate) : new Date(Date.now() + 86400000);
      if (validTo <= validFrom) throw new Error("Valid until must be after valid from");
      const [invite] = await tx.insert(visitorInvites).values({
        societyId,
        unitId,
        visitorId: visitor.id,
        createdBy: sess.userId,
        approvedBy: sess.userId,
        status: "APPROVED",
        code,
        qrToken,
        purpose: parsed.data.purpose,
        validFrom,
        validTo,
      }).returning();
      return { visitor, invite, unitId };
    });

    await audit({ actorId: sess.userId, societyId, action: "create", entity: "visitor_invite", entityId: result.invite.id, newState: { visitor: result.visitor, invite: result.invite } });

    return NextResponse.json({ visitor: result.visitor, invite: result.invite }, { status: 201 });
  } catch (e: any) {
    if (e.message?.startsWith("Forbidden")) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e.message === "Unit not in society" || e.message?.includes("not found")) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e.message?.includes("Valid until")) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
