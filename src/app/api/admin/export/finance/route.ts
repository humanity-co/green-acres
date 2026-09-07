import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { bills, units } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { toCsv, csvResponse } from "@/lib/csv";
import { amountToPaise } from "@/lib/payments/provider";

export async function GET() {
  const auth = await requireAuthAndSociety("report:finance");
  if ("error" in auth) return auth.error as any;
  try {
    const { societyId, sess } = auth as any;
    const csv = await withTenant(societyId, sess.userId, async (tx) => {
      const bs = await tx
        .select({
          title: bills.title,
          unitNumber: units.number,
          periodStart: bills.periodStart,
          periodEnd: bills.periodEnd,
          dueDate: bills.dueDate,
          total: bills.total,
          status: bills.status,
        })
        .from(bills)
        .leftJoin(units, eq(units.id, bills.unitId))
        .where(eq(bills.societyId, societyId))
        .limit(1000);

      const rows = bs.map(b => [
        b.title,
        b.unitNumber ? `Flat ${b.unitNumber}` : "General",
        b.periodStart,
        b.periodEnd,
        b.dueDate,
        b.total,
        b.status,
      ]);
      const h = ["Title", "Unit", "PeriodStart", "PeriodEnd", "DueDate", "Total", "Status"];
      let total = 0;
      for (const b of bs) {
        try { total += amountToPaise(b.total); } catch {}
      }
      const footer: any[][] = [["", "", "", "", "TotalBilled", (total/100).toFixed(2), ""]];
      return toCsv(h, [...rows, ...footer]);
    });
    return csvResponse(csv, `finance-${societyId}.csv`);
  } catch {
    return new Response("Failed", { status: 500 });
  }
}
