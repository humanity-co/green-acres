import { NextResponse } from "next/server";
import { notifications } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(notifications).where(and(eq(notifications.id, id), eq(notifications.societyId, societyId), eq(notifications.userId, sess.userId)));
      if (!existing) throw new Error("Not found");
      const [upd] = await tx.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.societyId, societyId), eq(notifications.userId, sess.userId))).returning();
      return upd;
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
