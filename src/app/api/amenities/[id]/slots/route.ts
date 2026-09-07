import { NextResponse } from "next/server";
import { amenitySlots, amenities } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("amenity:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const slots = await withTenant(societyId, sess.userId, async (tx)=>{
      const [a] = await tx.select().from(amenities).where(and(eq(amenities.id, id), eq(amenities.societyId, societyId)));
      if (!a) throw new Error("Not found");
      return tx.select().from(amenitySlots).where(and(eq(amenitySlots.amenityId, id), eq(amenitySlots.societyId, societyId)));
    });
    return NextResponse.json(slots);
  } catch (e:any) {
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json({ error:"Failed" }, { status:500 });
  }
}

const createSchema = z.object({ dayOfWeek: z.number().min(0).max(6), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("amenity:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;
    const slot = await withTenant(societyId, sess.userId, async (tx)=>{
      const [a] = await tx.select().from(amenities).where(and(eq(amenities.id, id), eq(amenities.societyId, societyId)));
      if (!a) throw new Error("Not found");
      const [created] = await tx.insert(amenitySlots).values({ societyId, amenityId: id, dayOfWeek: parsed.data.dayOfWeek, startTime: parsed.data.startTime, endTime: parsed.data.endTime }).returning();
      return created;
    });
    await audit({ actorId: sess.userId, societyId, action:"create", entity:"amenity_slot", entityId: slot.id, newState: slot });
    return NextResponse.json(slot, { status:201 });
  } catch (e:any) {
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
