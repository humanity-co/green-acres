import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { gates, visitorEntries } from "@/lib/db/schema";
import { eq, count, and, isNull, desc } from "drizzle-orm";
export async function GET() {
  const auth = await requireAuthAndSociety("gate:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const gs = await tx.select().from(gates).where(eq(gates.societyId, societyId)).orderBy(desc(gates.createdAt));
      const enriched = await Promise.all(gs.map(async (g) => {
        const [inside] = await tx.select({ c: count() }).from(visitorEntries).where(and(eq(visitorEntries.societyId, societyId), eq(visitorEntries.gateId, g.id), isNull(visitorEntries.checkOut)));
        const [total] = await tx.select({ c: count() }).from(visitorEntries).where(and(eq(visitorEntries.societyId, societyId), eq(visitorEntries.gateId, g.id)));
        return { gate: g, inside: inside.c, total: total.c };
      }));
      return enriched;
    });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
