import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { units, unitMembers, visitorEntries, deliveries, dailyHelpAttendance, vehicles, bookings, bills, payments, emergencyAlerts, helpdeskTickets, announcements, events, polls } from "@/lib/db/schema";
import { eq, and, count, sql, gte, isNull } from "drizzle-orm";
import { amountToPaise } from "@/lib/payments/provider";
export async function GET() {
  const auth = await requireAuthAndSociety("admin:overview");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const [
        [uCount],
        [rCount],
        [vToday],
        [vInside],
        [dPending],
        [hInside],
        [vehCount],
        [bActive],
        [annCount],
        [evCount],
        [pollCount],
        [emOpen],
        [ticketOpen],
        [billsSummary],
        [overdueBills],
        [paymentsSummary],
      ] = await Promise.all([
        tx.select({ c: count() }).from(units).where(eq(units.societyId, societyId)),
        tx.select({ c: count() }).from(unitMembers).where(eq(unitMembers.societyId, societyId)),
        tx.select({ c: count() }).from(visitorEntries).where(and(eq(visitorEntries.societyId, societyId), gte(visitorEntries.createdAt, today))),
        tx.select({ c: count() }).from(visitorEntries).where(and(eq(visitorEntries.societyId, societyId), isNull(visitorEntries.checkOut))),
        tx.select({ c: count() }).from(deliveries).where(and(eq(deliveries.societyId, societyId), eq(deliveries.status, "AT_GATE"))),
        tx.select({ c: count() }).from(dailyHelpAttendance).where(and(eq(dailyHelpAttendance.societyId, societyId), isNull(dailyHelpAttendance.checkOut))),
        tx.select({ c: count() }).from(vehicles).where(eq(vehicles.societyId, societyId)),
        tx.select({ c: count() }).from(bookings).where(and(eq(bookings.societyId, societyId), eq(bookings.status, "CONFIRMED"))),
        tx.select({ c: count() }).from(announcements).where(eq(announcements.societyId, societyId)),
        tx.select({ c: count() }).from(events).where(eq(events.societyId, societyId)),
        tx.select({ c: count() }).from(polls).where(eq(polls.societyId, societyId)),
        tx.select({ c: count() }).from(emergencyAlerts).where(and(eq(emergencyAlerts.societyId, societyId), eq(emergencyAlerts.status, "OPEN"))),
        tx.select({ c: count() }).from(helpdeskTickets).where(and(eq(helpdeskTickets.societyId, societyId), eq(helpdeskTickets.status, "OPEN"))).catch(() => [{ c: 0 }]),
        tx.select({
          totalSum: sql<string>`coalesce(sum(${bills.total}), 0)::text`,
          totalCount: sql<number>`count(*)::int`,
        }).from(bills).where(eq(bills.societyId, societyId)),
        tx.select({
          count: sql<number>`count(*)::int`,
        }).from(bills).where(and(
          eq(bills.societyId, societyId),
          sql`${bills.status} != 'PAID'`,
          sql`${bills.dueDate} < now()`
        )),
        tx.select({
          collectedSum: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
        }).from(payments).where(and(eq(payments.societyId, societyId), eq(payments.status, "SUCCESS"))),
      ]);

      const totalBilled = amountToPaise(billsSummary?.totalSum || "0");
      const collected = amountToPaise(paymentsSummary?.collectedSum || "0");
      const outstanding = Math.max(0, totalBilled - collected);
      const overdue = overdueBills?.count || 0;
      const billCount = billsSummary?.totalCount || 0;

      return {
        totalUnits: uCount?.c || 0,
        residents: rCount?.c || 0,
        visitorsToday: vToday?.c || 0,
        visitorsInside: vInside?.c || 0,
        pendingDeliveries: dPending?.c || 0,
        helpInside: hInside?.c || 0,
        vehicles: vehCount?.c || 0,
        activeBookings: bActive?.c || 0,
        announcements: annCount?.c || 0,
        events: evCount?.c || 0,
        polls: pollCount?.c || 0,
        emergenciesOpen: emOpen?.c || 0,
        ticketsOpen: ticketOpen?.c || 0,
        finance: {
          totalBilledPaise: totalBilled,
          collectedPaise: collected,
          outstandingPaise: outstanding,
          overdueCount: overdue,
          billCount,
        },
      };
    });
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
