import { NextResponse } from "next/server";
import { visitorEntries, visitors, units } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { maskPhone } from "@/lib/privacy";

export async function GET() {
  const auth = await requireAuthAndSociety("visitor:entry");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) => {
      const entries = await tx.select().from(visitorEntries).where(and(eq(visitorEntries.societyId, societyId), isNull(visitorEntries.checkOut))).orderBy(desc(visitorEntries.checkIn)).limit(50);
      const enriched = await Promise.all(entries.map(async e => {
        const [v] = await tx.select().from(visitors).where(eq(visitors.id, e.visitorId));
        const [u] = await tx.select().from(units).where(eq(units.id, e.unitId));
        const masked = v ? { ...v, phone: maskPhone(v.phone) } : v;
        return { entry: e, visitor: masked, unit: u };
      }));
      return enriched;
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
