import { NextResponse } from "next/server";
import { visitorInvites, visitors, units } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, inArray } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { maskPhone } from "@/lib/privacy";

export async function GET() {
  const auth = await requireAuthAndSociety("visitor:entry");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const now = new Date();
    const items = await withTenant(societyId, sess.userId, async (tx) => {
      const invites = await tx
        .select()
        .from(visitorInvites)
        .where(
          and(
            eq(visitorInvites.societyId, societyId),
            inArray(visitorInvites.status, ["PENDING", "APPROVED"])
          )
        )
        .orderBy(desc(visitorInvites.validFrom))
        .limit(50);

      const filtered = invites.filter(iv => new Date(iv.validTo) >= now).slice(0, 30);
      if (filtered.length === 0) return [];

      const visitorIds = Array.from(new Set(filtered.map(iv => iv.visitorId)));
      const unitIds = Array.from(new Set(filtered.map(iv => iv.unitId)));

      const [vs, us] = await Promise.all([
        tx.select().from(visitors).where(inArray(visitors.id, visitorIds)),
        tx.select().from(units).where(inArray(units.id, unitIds)),
      ]);

      const visitorMap = new Map(vs.map(v => [v.id, v]));
      const unitMap = new Map(us.map(u => [u.id, u]));

      return filtered.map(iv => {
        const v = visitorMap.get(iv.visitorId);
        const u = unitMap.get(iv.unitId);
        const masked = v ? { ...v, phone: maskPhone(v.phone) } : null;
        return { invite: iv, visitor: masked, unit: u || null };
      });
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
