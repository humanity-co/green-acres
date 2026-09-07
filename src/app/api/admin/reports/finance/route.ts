import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { bills, payments } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { amountToPaise } from "@/lib/payments/provider";

export async function GET() {
  const auth = await requireAuthAndSociety("report:finance");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      // 1. Database-level aggregation for bills by status
      const billsAgg = await tx
        .select({
          status: bills.status,
          count: sql<number>`count(*)::int`,
          totalSum: sql<string>`coalesce(sum(${bills.total}), 0)::text`,
        })
        .from(bills)
        .where(eq(bills.societyId, societyId))
        .groupBy(bills.status);

      // 2. Overdue bills aggregation in SQL
      const [overdueRes] = await tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(bills)
        .where(
          and(
            eq(bills.societyId, societyId),
            sql`${bills.status} != 'PAID'`,
            sql`${bills.dueDate} < now()`
          )
        );

      // 3. Database-level aggregation for payments by status
      const paymentsAgg = await tx
        .select({
          status: payments.status,
          count: sql<number>`count(*)::int`,
          amountSum: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
        })
        .from(payments)
        .where(eq(payments.societyId, societyId))
        .groupBy(payments.status);

      // 4. Fetch 10 most recent payments with index
      const recent = await tx
        .select({
          id: payments.id,
          amount: payments.amount,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.societyId, societyId))
        .orderBy(desc(payments.createdAt))
        .limit(10);

      const byStatus: Record<string, { count: number; paise: number }> = {};
      let totalBilled = 0;
      let billCount = 0;
      for (const b of billsAgg) {
        const p = (() => { try { return amountToPaise(b.totalSum); } catch { return 0; } })();
        totalBilled += p;
        billCount += b.count;
        byStatus[b.status] = { count: b.count, paise: p };
      }

      const payByStatus: Record<string, number> = {};
      let collected = 0;
      let failed = 0;
      for (const p of paymentsAgg) {
        payByStatus[p.status] = p.count;
        if (p.status === "SUCCESS") {
          try { collected = amountToPaise(p.amountSum); } catch {}
        }
        if (p.status === "FAILED") failed = p.count;
      }

      const outstanding = Math.max(0, totalBilled - collected);
      const overdueCount = overdueRes?.count || 0;

      return {
        totalBilledPaise: totalBilled,
        collectedPaise: collected,
        outstandingPaise: outstanding,
        overdueCount,
        billCount,
        billByStatus: byStatus,
        paymentByStatus: payByStatus,
        failedCount: failed,
        recentPayments: recent,
      };
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
