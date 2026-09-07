import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { societies, userSocietyRoles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("society:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { sess } = auth as any;
    const [membership] = await db.select().from(userSocietyRoles).where(and(eq(userSocietyRoles.userId, sess.userId), eq(userSocietyRoles.societyId, id)));
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [item] = await db.select().from(societies).where(eq(societies.id, id));
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("society:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { sess, societyId } = auth as any;
    if (id !== societyId) {
      // P0 FIX: Verify caller has society:manage permission in the TARGET society,
      // not merely any membership row. Old check only verified row existence,
      // allowing a resident in Society B to patch Society B while being admin in A.
      const [membership] = await db.select().from(userSocietyRoles)
        .where(and(eq(userSocietyRoles.userId, sess.userId), eq(userSocietyRoles.societyId, id)));
      if (!membership || !can([membership.role], "society:manage")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const body = await req.json();
    const allowed: any = {};
    if (body.name) allowed.name = String(body.name).slice(0, 100);
    if (body.address) allowed.address = String(body.address).slice(0, 500);
    const [prev] = await db.select().from(societies).where(eq(societies.id, id));
    const [item] = await db.update(societies).set(allowed).where(eq(societies.id, id)).returning();
    await audit({ actorId: sess.userId, societyId: id, action: "update", entity: "society", entityId: id, prevState: prev, newState: item });
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("society:delete");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { sess } = auth as any;
    // P0 FIX: Must verify role grants society:delete in the TARGET society specifically.
    // Active society check alone is insufficient — an admin of Society A must not be
    // able to delete Society B even if they hold any role there.
    const [membership] = await db.select().from(userSocietyRoles)
      .where(and(eq(userSocietyRoles.userId, sess.userId), eq(userSocietyRoles.societyId, id)));
    if (!membership || !can([membership.role], "society:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [prev] = await db.select().from(societies).where(eq(societies.id, id));
    await db.delete(societies).where(eq(societies.id, id));
    await audit({ actorId: sess.userId, societyId: id, action: "delete", entity: "society", entityId: id, prevState: prev });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
