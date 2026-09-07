import { NextResponse } from "next/server";
import { events } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("event:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const item = await withTenant(societyId, sess.userId, async (tx) => {
      const [row] = await tx.select().from(events).where(and(eq(events.id, id), eq(events.societyId, societyId)));
      return row || null;
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("event:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, startsAt, endsAt, location } = body;
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(events).where(and(eq(events.id, id), eq(events.societyId, societyId)));
      if (!existing) throw new Error("Not found");
      const patch: any = {};
      if (title) patch.title = title;
      if (description !== undefined) patch.description = description;
      if (startsAt) patch.startsAt = new Date(startsAt);
      if (endsAt !== undefined) patch.endsAt = endsAt ? new Date(endsAt) : null;
      if (location !== undefined) patch.location = location;
      if (Object.keys(patch).length === 0) return existing;
      const [upd] = await tx.update(events).set(patch).where(and(eq(events.id, id), eq(events.societyId, societyId))).returning();
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action: "update", entity: "event", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("event:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(events).where(and(eq(events.id, id), eq(events.societyId, societyId)));
      if (!existing) throw new Error("Not found");
      await tx.delete(events).where(and(eq(events.id, id), eq(events.societyId, societyId)));
    });
    await audit({ actorId: sess.userId, societyId, action: "delete", entity: "event", entityId: id });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
