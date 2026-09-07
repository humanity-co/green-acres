import { NextResponse } from "next/server";
import { parkingSlots, units } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

const schema = z.object({ unitId: z.string().uuid().nullable(), type: z.string().optional() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("parking:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const item = await withTenant(societyId, sess.userId, async (tx)=>{
      const [slot] = await tx.select().from(parkingSlots).where(and(eq(parkingSlots.id, id), eq(parkingSlots.societyId, societyId)));
      return slot || null;
    });
    if (!item) return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("parking:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;

    const updated = await withTenant(societyId, sess.userId, async (tx)=>{
      const [slot] = await tx.select().from(parkingSlots).where(and(eq(parkingSlots.id, id), eq(parkingSlots.societyId, societyId)));
      if (!slot) throw new Error("Not found");
      if (parsed.data.unitId) {
        const [unit] = await tx.select().from(units).where(and(eq(units.id, parsed.data.unitId), eq(units.societyId, societyId)));
        if (!unit) throw new Error("Unit not in society");
      }
      const [upd] = await tx.update(parkingSlots).set({ unitId: parsed.data.unitId, type: parsed.data.type || slot.type }).where(and(eq(parkingSlots.id, id), eq(parkingSlots.societyId, societyId))).returning();
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action:"update", entity:"parking_slot", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e:any) {
    if (e.message==="Not found" || e.message==="Unit not in society") return NextResponse.json({ error:e.message }, { status:404 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
