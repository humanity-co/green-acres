import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { visitorEntries, deliveries, dailyHelpAttendance, vehicles } from "@/lib/db/schema";
import { eq, count, and, isNull, gte, desc, sql } from "drizzle-orm";
export async function GET() {
  const auth = await requireAuthAndSociety("report:security");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const today = new Date(); today.setHours(0,0,0,0);
      const [totalEntries] = await tx.select({ c: count() }).from(visitorEntries).where(eq(visitorEntries.societyId, societyId));
      const [todayEntries] = await tx.select({ c: count() }).from(visitorEntries).where(and(eq(visitorEntries.societyId, societyId), gte(visitorEntries.createdAt, today)));
      const [inside] = await tx.select({ c: count() }).from(visitorEntries).where(and(eq(visitorEntries.societyId, societyId), isNull(visitorEntries.checkOut)));
      const [delTotal] = await tx.select({ c: count() }).from(deliveries).where(eq(deliveries.societyId, societyId));
      const [delPending] = await tx.select({ c: count() }).from(deliveries).where(and(eq(deliveries.societyId, societyId), eq(deliveries.status, "AT_GATE")));
      const [helpInside] = await tx.select({ c: count() }).from(dailyHelpAttendance).where(and(eq(dailyHelpAttendance.societyId, societyId), isNull(dailyHelpAttendance.checkOut)));
      const [vehCount] = await tx.select({ c: count() }).from(vehicles).where(eq(vehicles.societyId, societyId));
      const recentEntries = await tx.select().from(visitorEntries).where(eq(visitorEntries.societyId, societyId)).orderBy(desc(visitorEntries.createdAt)).limit(10);
      return { totalEntries: totalEntries.c, todayEntries: todayEntries.c, inside: inside.c, deliveriesTotal: delTotal.c, deliveriesPending: delPending.c, helpInside: helpInside.c, vehicles: vehCount.c, recentEntries, note: "Vehicle entry/exit not tracked — vehicle_entries table does not exist" };
    });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
