import { NextResponse, after } from "next/server";
import { emergencyAlerts, notifications, userSocietyRoles, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("emergency:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) =>
      tx.select().from(emergencyAlerts)
        .where(eq(emergencyAlerts.societyId, societyId))
        .orderBy(desc(emergencyAlerts.createdAt))
        .limit(50)
    );
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}

const schema = z.object({
  type: z.enum(["FIRE", "MEDICAL", "SECURITY", "PANIC", "LIFT", "OTHER"]),
  unitId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("emergency:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const { societyId, sess } = auth as any;

    const alert = await withTenant(societyId, sess.userId, async (tx) => {
      let unitId = parsed.data.unitId || null;
      if (!unitId) {
        const [myMem] = await tx.select({ unitId: unitMembers.unitId })
          .from(unitMembers)
          .where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        if (myMem) unitId = myMem.unitId;
      }

      const [createdAlert] = await tx.insert(emergencyAlerts).values({
        societyId,
        raisedBy: sess.userId,
        type: parsed.data.type,
        description: parsed.data.description,
        location: parsed.data.location,
        unitId,
        status: "OPEN",
      }).returning();

      await audit({
        actorId: sess.userId,
        societyId,
        action: "create",
        entity: "emergency_alert",
        entityId: createdAlert.id,
        newState: createdAlert,
        tx,
      });

      return createdAlert;
    });

    // Step 2: Fan-out notifications asynchronously via Next.js after() with tenant context
    after(async () => {
      try {
        await withTenant(societyId, sess.userId, async (tx) => {
          const members = await tx
            .select({ userId: userSocietyRoles.userId })
            .from(userSocietyRoles)
            .where(eq(userSocietyRoles.societyId, societyId));

          const CHUNK = 500;
          const notifRows = members.map(m => ({
            societyId,
            userId: m.userId,
            title: `🚨 Emergency Alert — ${parsed.data.type}`,
            body: parsed.data.description || `Emergency alert raised. Guards have been notified.`,
            channel: "IN_APP" as const,
            relatedEntity: "emergency_alert",
            relatedId: alert.id,
          }));

          for (let i = 0; i < notifRows.length; i += CHUNK) {
            await tx.insert(notifications).values(notifRows.slice(i, i + CHUNK));
          }
        });
      } catch (e) {
        console.error("[EMERGENCY FAN-OUT] Notification batch failed for alert", alert.id, e);
      }
    });

    // Return the alert immediately — client does not wait for fan-out to complete
    return NextResponse.json(alert, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
