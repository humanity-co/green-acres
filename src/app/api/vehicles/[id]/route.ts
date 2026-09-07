import { NextResponse } from "next/server";
import { vehicles, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("vehicle:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx)=>{
      const [v] = await tx.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.societyId, societyId)));
      if (!v) return null;
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["GUARD","SECURITY_MANAGER","SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
      if (!isPrivileged) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, v.unitId)));
        if (members.length===0) throw new Error("Forbidden");
      }
      return v;
    });
    if (!data) return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json(data);
  } catch (e:any) {
    if (e.message==="Forbidden") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    return NextResponse.json({ error:"Failed" }, { status:500 });
  }
}

const patchSchema = z.object({
  type: z.enum(["Car","Motorcycle","Scooter","EV","Other","CAR","MOTORCYCLE","SCOOTER","EV","OTHER"]).transform(v=>v.toUpperCase()).optional(),
  stickerNo: z.string().max(20).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("vehicle:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx)=>{
      const [v] = await tx.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.societyId, societyId)));
      if (!v) throw new Error("Not found");
      const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, v.unitId)));
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
      if (members.length===0 && !isPrivileged && v.userId!==sess.userId) throw new Error("Forbidden");
      const allowed:any={};
      if (parsed.data.type) allowed.type = parsed.data.type;
      if (parsed.data.stickerNo!==undefined) allowed.stickerNo = parsed.data.stickerNo;
      if (Object.keys(allowed).length===0) throw new Error("No updates");
      const [upd] = await tx.update(vehicles).set(allowed).where(and(eq(vehicles.id, id), eq(vehicles.societyId, societyId))).returning();
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action:"update", entity:"vehicle", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e:any) {
    if (e.message==="Forbidden") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("vehicle:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    await withTenant(societyId, sess.userId, async (tx)=>{
      const [v] = await tx.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.societyId, societyId)));
      if (!v) throw new Error("Not found");
      const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, v.unitId)));
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","SUPER_ADMIN"].includes(r));
      if (members.length===0 && !isPrivileged && v.userId!==sess.userId) throw new Error("Forbidden");
      await tx.delete(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.societyId, societyId)));
    });
    await audit({ actorId: sess.userId, societyId, action:"delete", entity:"vehicle", entityId: id });
    return NextResponse.json({ success:true });
  } catch (e:any) {
    if (e.message==="Forbidden") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
