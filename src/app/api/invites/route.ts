import { NextResponse } from "next/server";
import { visitorInvites, visitors, units, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { randomInt } from "crypto";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("visitor:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m => m.getUserRoles(sess.userId, societyId));
    const isPrivileged = roles.some((r: string) => ["GUARD", "SECURITY_MANAGER", "SOCIETY_ADMIN", "FACILITY_MANAGER", "SUPER_ADMIN"].includes(r));

    const items = await withTenant(societyId, sess.userId, async (tx) => {
      let rawInvites: any[] = [];
      if (isPrivileged) {
        rawInvites = await tx.select().from(visitorInvites).where(eq(visitorInvites.societyId, societyId)).orderBy(desc(visitorInvites.createdAt)).limit(50);
      } else {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m => m.unitId);
        if (unitIds.length === 0) return [];
        rawInvites = await tx.select().from(visitorInvites).where(and(eq(visitorInvites.societyId, societyId), inArray(visitorInvites.unitId, unitIds))).orderBy(desc(visitorInvites.createdAt)).limit(50);
      }

      if (rawInvites.length === 0) return [];
      const visitorIds = Array.from(new Set(rawInvites.map(i => i.visitorId)));
      const vs = await tx.select().from(visitors).where(inArray(visitors.id, visitorIds));
      const vMap = new Map(vs.map(v => [v.id, v]));

      return rawInvites.map(iv => {
        const v = vMap.get(iv.visitorId);
        return {
          ...iv,
          visitorName: v?.name || null,
          visitorPhone: v?.phone || null,
        };
      });
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const s = z.object({
  unitId: z.string().uuid(),
  visitorId: z.string().uuid(),
  purpose: z.string().max(200).optional(),
  validTo: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("visitor:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = s.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;

    const item = await withTenant(societyId, sess.userId, async (tx) => {
      const [unit] = await tx.select().from(units).where(and(eq(units.id, parsed.data.unitId), eq(units.societyId, societyId)));
      if (!unit) throw new Error("Unit not in society");

      const roles = await import("@/lib/tenant").then(m => m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r: string) => ["SOCIETY_ADMIN", "FACILITY_MANAGER", "SUPER_ADMIN"].includes(r));
      if (!isPrivileged) {
        const [membership] = await tx.select().from(unitMembers).where(and(
          eq(unitMembers.userId, sess.userId),
          eq(unitMembers.unitId, parsed.data.unitId),
          eq(unitMembers.societyId, societyId)
        ));
        if (!membership) {
          throw new Error("Forbidden: You are not a registered member of this unit");
        }
      }

      const [visitor] = await tx.select().from(visitors).where(and(eq(visitors.id, parsed.data.visitorId), eq(visitors.societyId, societyId)));
      if (!visitor) throw new Error("Visitor not in society");

      const code = randomInt(100000, 1000000).toString().slice(0, 4).toUpperCase() + randomInt(10, 99).toString();
      const [created] = await tx.insert(visitorInvites).values({
        societyId,
        unitId: parsed.data.unitId,
        visitorId: parsed.data.visitorId,
        createdBy: sess.userId,
        approvedBy: sess.userId,
        status: "APPROVED",
        code,
        purpose: parsed.data.purpose,
        validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : new Date(Date.now() + 86400000),
      }).returning();
      return created;
    });

    await audit({ actorId: sess.userId, societyId, action: "create", entity: "visitor_invite", entityId: item.id, newState: item });
    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("Forbidden")) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
