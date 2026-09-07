import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { announcements, polls, pollVotes, events, emergencyAlerts, notifications } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";
export async function GET() {
  const auth = await requireAuthAndSociety("report:community");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const [annCount] = await tx.select({ c: count() }).from(announcements).where(eq(announcements.societyId, societyId));
      const [pollCount] = await tx.select({ c: count() }).from(polls).where(eq(polls.societyId, societyId));
      const [evCount] = await tx.select({ c: count() }).from(events).where(eq(events.societyId, societyId));
      const [emCount] = await tx.select({ c: count() }).from(emergencyAlerts).where(eq(emergencyAlerts.societyId, societyId));
      const [notifCount] = await tx.select({ c: count() }).from(notifications).where(eq(notifications.societyId, societyId));
      const votes = await tx.select().from(pollVotes).limit(500);
      const pollParticipation = votes.length;
      return { announcements: annCount.c, polls: pollCount.c, events: evCount.c, emergencies: emCount.c, notifications: notifCount.c, pollParticipation, note: "No fake engagement metrics" };
    });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
