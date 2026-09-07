import { NextResponse } from "next/server";
import { dailyHelp, dailyHelpLinks, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("help:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx)=>{
      const [help] = await tx.select().from(dailyHelp).where(and(eq(dailyHelp.id, id), eq(dailyHelp.societyId, societyId)));
      if (!help) return null;
      const links = await tx.select().from(dailyHelpLinks).where(and(eq(dailyHelpLinks.helpId, id), eq(dailyHelpLinks.societyId, societyId)));
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["GUARD","SECURITY_MANAGER","SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
      if (!isPrivileged) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (!links.some(l=> unitIds.includes(l.unitId))) throw new Error("Forbidden");
      }
      const attendance = await tx.select().from((await import("@/lib/db/schema")).dailyHelpAttendance).where(and(eq((await import("@/lib/db/schema")).dailyHelpAttendance.helpId, id), eq((await import("@/lib/db/schema")).dailyHelpAttendance.societyId, societyId))).then(rows=>rows.slice(-10));
      // simpler without attendance join for now
      return { help, links };
    });
    if (!data) return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json(data);
  } catch (e:any) {
    if (e.message==="Forbidden") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    return NextResponse.json({ error:"Failed" }, { status:500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("help:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx)=>{
      const [help] = await tx.select().from(dailyHelp).where(and(eq(dailyHelp.id, id), eq(dailyHelp.societyId, societyId)));
      if (!help) throw new Error("Not found");
      const allowed: any = {};
      if (body.name) allowed.name = String(body.name).slice(0,100);
      if (body.category) allowed.category = body.category;
      if (body.policeVerified!==undefined) allowed.policeVerified = Boolean(body.policeVerified);
      if (Object.keys(allowed).length===0) throw new Error("No updates");
      const [upd] = await tx.update(dailyHelp).set(allowed).where(and(eq(dailyHelp.id, id), eq(dailyHelp.societyId, societyId))).returning();
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action:"update", entity:"daily_help", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e:any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("help:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;

    let targetUnitId: string | null = null;
    try {
      const body = await req.json();
      targetUnitId = body?.unitId || null;
    } catch {}

    const deleted = await withTenant(societyId, sess.userId, async (tx) => {
      const [help] = await tx.select().from(dailyHelp).where(and(eq(dailyHelp.id, id), eq(dailyHelp.societyId, societyId)));
      if (!help) throw new Error("Not found");

      const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
      const userUnitIds = members.map((m) => m.unitId);

      const roles = await import("@/lib/tenant").then((m) => m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r: string) => ["SOCIETY_ADMIN", "SUPER_ADMIN"].includes(r));

      // Determine which units to unlink
      const unitsToUnlink = targetUnitId ? [targetUnitId] : (isPrivileged ? [] : userUnitIds);

      if (!isPrivileged && unitsToUnlink.length === 0) {
        throw new Error("Forbidden");
      }

      if (isPrivileged && (!targetUnitId || targetUnitId === "ALL")) {
        // Admin deleting globally
        await tx.delete(dailyHelpLinks).where(and(eq(dailyHelpLinks.helpId, id), eq(dailyHelpLinks.societyId, societyId)));
        await tx.update(dailyHelp).set({ isActive: false }).where(and(eq(dailyHelp.id, id), eq(dailyHelp.societyId, societyId)));
      } else {
        // Unlink specific units
        for (const uid of unitsToUnlink) {
          await tx
            .delete(dailyHelpLinks)
            .where(
              and(
                eq(dailyHelpLinks.helpId, id),
                eq(dailyHelpLinks.unitId, uid),
                eq(dailyHelpLinks.societyId, societyId)
              )
            );
        }

        // Check if remaining links exist
        const remaining = await tx
          .select()
          .from(dailyHelpLinks)
          .where(and(eq(dailyHelpLinks.helpId, id), eq(dailyHelpLinks.societyId, societyId)));

        if (remaining.length === 0) {
          await tx.update(dailyHelp).set({ isActive: false }).where(and(eq(dailyHelp.id, id), eq(dailyHelp.societyId, societyId)));
        }
      }

      return help;
    });

    await audit({ actorId: sess.userId, societyId, action: "unlink", entity: "daily_help", entityId: id, prevState: deleted });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
