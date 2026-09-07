import { NextResponse } from "next/server";
import { vehicles, unitMembers, units } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("vehicle:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
    const isPrivileged = roles.some((r:string)=>["GUARD","SECURITY_MANAGER","SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      if (isPrivileged) {
        return tx.select().from(vehicles).where(eq(vehicles.societyId, societyId)).orderBy(desc(vehicles.createdAt)).limit(50);
      } else {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (unitIds.length===0) return [];
        return tx.select().from(vehicles).where(and(eq(vehicles.societyId, societyId), inArray(vehicles.unitId, unitIds))).orderBy(desc(vehicles.createdAt)).limit(50);
      }
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

const createSchema = z.object({
  numberPlate: z.string().min(2).max(20),
  type: z.enum(["Car","Motorcycle","Scooter","EV","Other","CAR","MOTORCYCLE","SCOOTER","EV","OTHER"]).transform(v=> v.toUpperCase()),
  stickerNo: z.string().max(20).optional(),
  unitId: z.string().uuid().optional(),
});

function normalizePlate(s: string){ return s.replace(/\s+/g, "").replace(/-+/g, "").toUpperCase(); }

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("vehicle:manage");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;
    const normalized = normalizePlate(parsed.data.numberPlate);

    const item = await withTenant(societyId, sess.userId, async (tx)=>{
      let unitId = parsed.data.unitId;
      if (!unitId) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        if (members.length===0) throw new Error("No unit membership");
        unitId = members[0].unitId;
      } else {
        const [unit] = await tx.select().from(units).where(and(eq(units.id, unitId), eq(units.societyId, societyId)));
        if (!unit) throw new Error("Unit not in society");
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, unitId)));
        const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
        const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
        if (members.length===0 && !isPrivileged) throw new Error("Not a member of unit");
      }
      const existing = await tx.select().from(vehicles).where(and(eq(vehicles.societyId, societyId), eq(vehicles.numberPlate, normalized)));
      if (existing.length>0) throw new Error("Duplicate registration number in this society");
      const [created] = await tx.insert(vehicles).values({
        societyId, unitId, userId: sess.userId, numberPlate: normalized, type: parsed.data.type as any, stickerNo: parsed.data.stickerNo || null,
      }).returning();
      return created;
    });

    await audit({ actorId: sess.userId, societyId, action:"create", entity:"vehicle", entityId: item.id, newState: item });
    return NextResponse.json(item, { status:201 });
  } catch (e:any) {
    if (e.message?.includes("Duplicate")) return NextResponse.json({ error: e.message }, { status:409 });
    if (e.message?.includes("Not a member") || e.message?.includes("No unit")) return NextResponse.json({ error: e.message }, { status:403 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
