import { NextResponse } from "next/server";
import { notifications } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, isNull } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
export async function GET() {
  const auth = await requireAuthAndSociety();
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) => {
      return tx.select().from(notifications).where(and(eq(notifications.societyId, societyId), eq(notifications.userId, sess.userId))).orderBy(desc(notifications.createdAt)).limit(50);
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
