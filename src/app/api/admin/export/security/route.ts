import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { visitorEntries } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { toCsv, csvResponse } from "@/lib/csv";
export async function GET() {
  const auth = await requireAuthAndSociety("report:security");
  if ("error" in auth) return auth.error as any;
  try {
    const { societyId, sess } = auth as any;
    const csv = await withTenant(societyId, sess.userId, async (tx) => {
      const rows = await tx.select().from(visitorEntries).where(eq(visitorEntries.societyId, societyId)).orderBy(desc(visitorEntries.createdAt)).limit(200);
      const data = rows.map(r => [r.visitorId.slice(0,8), r.unitId.slice(0,8), r.checkIn.toISOString(), r.checkOut ? r.checkOut.toISOString() : "INSIDE", r.gateId?.slice(0,8) || ""]);
      return toCsv(["Visitor", "Unit", "CheckIn", "CheckOut", "Gate"], data);
    });
    return csvResponse(csv, `security-${societyId}.csv`);
  } catch { return new Response("Failed", { status: 500 }); }
}
