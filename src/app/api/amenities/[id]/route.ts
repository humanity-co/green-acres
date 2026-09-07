import { NextResponse } from "next/server";
import { amenities, amenitySlots } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { z } from "zod";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("amenity:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx)=>{
      const [amenity] = await tx.select().from(amenities).where(and(eq(amenities.id, id), eq(amenities.societyId, societyId)));
      if (!amenity) return null;
      const slots = await tx.select().from(amenitySlots).where(and(eq(amenitySlots.amenityId, id), eq(amenitySlots.societyId, societyId)));
      return { amenity, slots };
    });
    if (!data) return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

const patchSchema = z.object({ name: z.string().min(1).max(100).optional(), description: z.string().optional(), isActive: z.boolean().optional(), capacity: z.number().optional(), fee: z.string().optional(), rules: z.string().optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("amenity:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx)=>{
      const [a] = await tx.select().from(amenities).where(and(eq(amenities.id, id), eq(amenities.societyId, societyId)));
      if (!a) throw new Error("Not found");
      const allowed:any={};
      if (parsed.data.name) allowed.name = parsed.data.name;
      if (parsed.data.isActive!==undefined) allowed.isActive = parsed.data.isActive;
      if (parsed.data.capacity!==undefined) allowed.capacity = parsed.data.capacity;
      if (parsed.data.fee!==undefined) allowed.fee = parsed.data.fee;
      if (parsed.data.rules!==undefined) allowed.rules = parsed.data.rules;
      if (Object.keys(allowed).length===0) throw new Error("No updates");
      const [upd] = await tx.update(amenities).set(allowed).where(and(eq(amenities.id, id), eq(amenities.societyId, societyId))).returning();
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action:"update", entity:"amenity", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e:any) {
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
