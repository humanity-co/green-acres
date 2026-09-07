import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { bookings, amenities } from "@/lib/db/schema";
import { eq, count, desc, sql, and } from "drizzle-orm";
export async function GET() {
  const auth = await requireAuthAndSociety("report:amenity");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const allBookings = await tx.select().from(bookings).where(eq(bookings.societyId, societyId)).limit(500);
      const allAmenities = await tx.select().from(amenities).where(eq(amenities.societyId, societyId));
      const byAmenity: Record<string, number> = {};
      const byDate: Record<string, number> = {};
      let cancelled = 0;
      for (const b of allBookings) {
        byAmenity[b.amenityId] = (byAmenity[b.amenityId] || 0) + 1;
        const d = b.bookingDate as string;
        byDate[d] = (byDate[d] || 0) + 1;
        if (b.status === "CANCELLED") cancelled += 1;
      }
      const mostUsed = Object.entries(byAmenity).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, c]) => {
        const am = allAmenities.find(a => a.id === id);
        return { amenityId: id, name: am?.name || id.slice(0, 8), count: c };
      });
      const byDateSorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
      return { totalBookings: allBookings.length, cancelled, mostUsed, byAmenity, byDate: byDateSorted, amenityCount: allAmenities.length, note: "capacity is amenity-level, not per-slot; slot utilization not accurately calculable" };
    });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
