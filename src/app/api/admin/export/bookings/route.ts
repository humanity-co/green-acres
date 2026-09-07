import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { bookings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { toCsv, csvResponse } from "@/lib/csv";
export async function GET() {
  const auth = await requireAuthAndSociety("report:amenity");
  if ("error" in auth) return auth.error as any;
  try {
    const { societyId, sess } = auth as any;
    const csv = await withTenant(societyId, sess.userId, async (tx) => {
      const rows = await tx.select().from(bookings).where(eq(bookings.societyId, societyId)).orderBy(desc(bookings.createdAt)).limit(200);
      const data = rows.map(b => [b.amenityId.slice(0,8), b.unitId.slice(0,8), b.bookingDate as any, b.status, b.createdAt.toISOString()]);
      return toCsv(["Amenity", "Unit", "Date", "Status", "Created"], data);
    });
    return csvResponse(csv, `bookings-${societyId}.csv`);
  } catch { return new Response("Failed", { status: 500 }); }
}
