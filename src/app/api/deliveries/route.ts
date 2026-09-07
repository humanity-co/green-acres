import { NextResponse } from "next/server";
import { deliveries, units, unitMembers, notifications, users } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("delivery:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
    const isGuard = roles.some((r:string)=>["GUARD","SECURITY_MANAGER","SOCIETY_ADMIN","SUPER_ADMIN"].includes(r));
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      if (isGuard) {
        return tx.select().from(deliveries).where(eq(deliveries.societyId, societyId)).orderBy(desc(deliveries.createdAt)).limit(50);
      } else {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (unitIds.length===0) return [];
        return tx.select().from(deliveries).where(and(eq(deliveries.societyId, societyId), inArray(deliveries.unitId, unitIds))).orderBy(desc(deliveries.createdAt)).limit(50);
      }
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

const createSchema = z.object({
  unitId: z.string().uuid(),
  courierName: z.string().min(1).max(100),
  awb: z.string().max(50).optional(),
});

import { randomInt, createHash } from "crypto";

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("delivery:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;

    const rawOtp = String(randomInt(1000, 9999));
    const hashedOtp = createHash("sha256").update(rawOtp).digest("hex");
    const otpExpiry = new Date(Date.now() + 24 * 3600000); // 24 hours

    const item = await withTenant(societyId, sess.userId, async (tx)=>{
      const [unit] = await tx.select().from(units).where(and(eq(units.id, parsed.data.unitId), eq(units.societyId, societyId)));
      if (!unit) throw new Error("Unit not in society");
      const [created] = await tx.insert(deliveries).values({
        societyId,
        unitId: unit.id,
        courierName: parsed.data.courierName,
        awb: parsed.data.awb || null,
        status: "AT_GATE",
        guardId: sess.userId,
        otp: hashedOtp,
        otpExpiry,
      }).returning();

      const members = await tx.select().from(unitMembers).where(eq(unitMembers.unitId, unit.id));
      for (const m of members) {
        await tx.insert(notifications).values({
          societyId,
          userId: m.userId,
          title: `📦 Package at Gate: ${parsed.data.courierName}`,
          body: `Package from ${parsed.data.courierName} has arrived. Share OTP ${rawOtp} with guard to collect.`,
          channel: "IN_APP",
          relatedEntity: "delivery",
          relatedId: created.id,
        });
      }
      return created;
    });

    await audit({ actorId: sess.userId, societyId, action:"create", entity:"delivery", entityId: item.id, newState: item });
    return NextResponse.json(item, { status:201 });
  } catch (e:any) { return NextResponse.json({ error: e.message || "Failed" }, { status:500 }); }
}
