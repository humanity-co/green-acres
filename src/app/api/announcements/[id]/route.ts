import { NextResponse } from "next/server";
import { announcements } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("announcement:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const item = await withTenant(societyId, sess.userId, async (tx) => {
      const [row] = await tx.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.societyId, societyId)));
      return row || null;
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("announcement:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, body: b, priority, audienceScope } = body;
    if (title && (typeof title !== "string" || title.length < 1 || title.length > 200)) return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    if (b && (typeof b !== "string" || b.length < 1 || b.length > 5000)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.societyId, societyId)));
      if (!existing) throw new Error("Not found");
      const [upd] = await tx.update(announcements).set({ ...(title ? { title } : {}), ...(b ? { body: b } : {}), ...(priority ? { priority } : {}), ...(audienceScope ? { audienceScope } : {}) }).where(and(eq(announcements.id, id), eq(announcements.societyId, societyId))).returning();
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action: "update", entity: "announcement", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("announcement:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.societyId, societyId)));
      if (!existing) throw new Error("Not found");
      await tx.delete(announcements).where(and(eq(announcements.id, id), eq(announcements.societyId, societyId)));
    });
    await audit({ actorId: sess.userId, societyId, action: "delete", entity: "announcement", entityId: id });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
