import { NextResponse } from "next/server";
import { withTenant } from "@/lib/db/withTenant";
import { units } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("unit:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const item = await withTenant(societyId, sess.userId, async (tx) => {
      const [unit] = await tx.select().from(units).where(and(eq(units.id, id), eq(units.societyId, societyId)));
      return unit;
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("unit:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const body = await req.json();
    const allowed: any = {};
    if (body.number) allowed.number = String(body.number).slice(0, 20);
    if (body.status) allowed.status = String(body.status).slice(0, 20);

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [prev] = await tx.select().from(units).where(and(eq(units.id, id), eq(units.societyId, societyId)));
      if (!prev) return null;
      const [item] = await tx.update(units).set(allowed).where(and(eq(units.id, id), eq(units.societyId, societyId))).returning();
      return { prev, item };
    });

    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await audit({ actorId: sess.userId, societyId, action: "update", entity: "unit", entityId: id, prevState: result.prev, newState: result.item });
    return NextResponse.json(result.item);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("unit:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;

    const prev = await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(units).where(and(eq(units.id, id), eq(units.societyId, societyId)));
      if (!existing) return null;
      await tx.delete(units).where(and(eq(units.id, id), eq(units.societyId, societyId)));
      return existing;
    });

    if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await audit({ actorId: sess.userId, societyId, action: "delete", entity: "unit", entityId: id, prevState: prev });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
