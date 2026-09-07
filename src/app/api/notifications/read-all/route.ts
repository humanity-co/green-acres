import { NextResponse } from "next/server";
import { notifications } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, isNull } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
export async function POST() {
  const auth = await requireAuthAndSociety();
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    await withTenant(societyId, sess.userId, async (tx) => {
      await tx.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.societyId, societyId), eq(notifications.userId, sess.userId), isNull(notifications.readAt)));
    });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
