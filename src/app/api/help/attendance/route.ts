import { NextResponse } from "next/server";
import { dailyHelp, dailyHelpLinks, dailyHelpAttendance, gates, units } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { maskPhone } from "@/lib/privacy";

export async function GET() {
  const auth = await requireAuthAndSociety("help:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
    const isPrivileged = roles.some((r:string)=>["GUARD","SECURITY_MANAGER","SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      let atts;
      if (isPrivileged) {
        atts = await tx.select().from(dailyHelpAttendance).where(eq(dailyHelpAttendance.societyId, societyId)).orderBy(desc(dailyHelpAttendance.createdAt)).limit(50);
      } else {
        const { unitMembers } = await import("@/lib/db/schema");
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (unitIds.length===0) return [];
        const { inArray } = await import("drizzle-orm");
        atts = await tx.select().from(dailyHelpAttendance).where(and(eq(dailyHelpAttendance.societyId, societyId), inArray(dailyHelpAttendance.unitId, unitIds))).orderBy(desc(dailyHelpAttendance.createdAt)).limit(50);
      }
      if (atts.length === 0) return [];

      const { inArray: ormInArray } = await import("drizzle-orm");
      const helpIds = Array.from(new Set(atts.map((a) => a.helpId)));
      const unitIds = Array.from(new Set(atts.map((a) => a.unitId)));

      const [helpList, unitList] = await Promise.all([
        tx.select().from(dailyHelp).where(ormInArray(dailyHelp.id, helpIds)),
        tx.select().from(units).where(ormInArray(units.id, unitIds)),
      ]);

      const helpMap = new Map(helpList.map((h) => [h.id, h]));
      const unitMap = new Map(unitList.map((u) => [u.id, u]));

      return atts.map((a) => {
        const h = helpMap.get(a.helpId);
        const maskedHelp = h ? { ...h, phone: isPrivileged ? h.phone : maskPhone(h.phone) } : null;
        return { attendance: a, help: maskedHelp, unit: unitMap.get(a.unitId) || null };
      });
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

const checkInSchema = z.object({ helpId: z.string().uuid(), unitId: z.string().uuid(), gateId: z.string().uuid().optional() });
const checkOutSchema = z.object({ attendanceId: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("help:attendance");
  if ("error" in auth) return auth.error;
  const body = await req.json();
  // Determine if check-in or check-out by presence of helpId
  if (body.helpId) {
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;
    try {
      const gateId = parsed.data.gateId;
      if (gateId) {
        const gateOk = await withTenant(societyId, sess.userId, async (tx)=>{
          const [g] = await tx.select().from(gates).where(and(eq(gates.id, gateId), eq(gates.societyId, societyId)));
          return !!g;
        });
        if (!gateOk) return NextResponse.json({ error:"Gate not valid" }, { status:403 });
      }
      const result = await withTenant(societyId, sess.userId, async (tx)=>{
        const [help] = await tx.select().from(dailyHelp).where(and(eq(dailyHelp.id, parsed.data.helpId), eq(dailyHelp.societyId, societyId)));
        if (!help) throw new Error("Help not found");
        if (!help.isActive) throw new Error("Daily help is deactivated");
        const [link] = await tx.select().from(dailyHelpLinks).where(and(eq(dailyHelpLinks.helpId, parsed.data.helpId), eq(dailyHelpLinks.unitId, parsed.data.unitId), eq(dailyHelpLinks.societyId, societyId)));
        if (!link) throw new Error("Help not linked to unit");
        if (!link.isActive) throw new Error("Daily help link to this unit is inactive");
        const [unit] = await tx.select().from(units).where(and(eq(units.id, parsed.data.unitId), eq(units.societyId, societyId)));
        if (!unit) throw new Error("Unit not in society");
        const existing = await tx.select().from(dailyHelpAttendance).where(and(eq(dailyHelpAttendance.helpId, parsed.data.helpId), eq(dailyHelpAttendance.unitId, parsed.data.unitId), isNull(dailyHelpAttendance.checkOut)));
        if (existing.length>0) throw new Error("Already checked in");
        const [att] = await tx.insert(dailyHelpAttendance).values({ societyId, helpId: help.id, unitId: unit.id, gateId: gateId || null, checkIn: new Date(), verifiedBy: sess.userId }).returning();
        return att;
      });
      await audit({ actorId: sess.userId, societyId, action:"help:check_in", entity:"daily_help_attendance", entityId: result.id, newState: result });
      return NextResponse.json(result, { status:201 });
    } catch (e:any) {
      if (e.message==="Already checked in") return NextResponse.json({ error:e.message }, { status:409 });
      if (e.message?.includes("deactivated") || e.message?.includes("inactive")) return NextResponse.json({ error: e.message }, { status: 403 });
      if (e.message?.includes("not found") || e.message?.includes("not linked") || e.message?.includes("not in society")) return NextResponse.json({ error: e.message }, { status: 404 });
      return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
    }
  } else {
    const parsed = checkOutSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;
    try {
      const result = await withTenant(societyId, sess.userId, async (tx)=>{
        const [att] = await tx.select().from(dailyHelpAttendance).where(and(eq(dailyHelpAttendance.id, parsed.data.attendanceId), eq(dailyHelpAttendance.societyId, societyId)));
        if (!att) throw new Error("Attendance not found");
        if (att.checkOut) throw new Error("Already checked out");
        const [upd] = await tx.update(dailyHelpAttendance).set({ checkOut: new Date(), verifiedBy: sess.userId }).where(and(eq(dailyHelpAttendance.id, parsed.data.attendanceId), eq(dailyHelpAttendance.societyId, societyId))).returning();
        return upd;
      });
      await audit({ actorId: sess.userId, societyId, action:"help:check_out", entity:"daily_help_attendance", entityId: result.id, newState: result });
      return NextResponse.json(result);
    } catch (e:any) {
      if (e.message==="Already checked out") return NextResponse.json({ error:e.message }, { status:409 });
      return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
    }
  }
}
