import { NextResponse } from "next/server";
import { visitors, visitorInvites, units, gates, unitMembers, notifications, users } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { randomInt, randomUUID } from "crypto";

const schema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  unitId: z.string().uuid(),
  purpose: z.string().min(1).max(200),
  vehicleNumber: z.string().max(20).optional(),
  gateId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("visitor:entry");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
    }
    const { societyId, sess } = auth as any;
    const data = parsed.data;

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [unit] = await tx.select().from(units).where(and(eq(units.id, data.unitId), eq(units.societyId, societyId)));
      if (!unit) throw new Error("Unit not found");
      if (data.gateId) {
        const [gate] = await tx.select().from(gates).where(and(eq(gates.id, data.gateId), eq(gates.societyId, societyId)));
        if (!gate) throw new Error("Gate not valid");
      }

      const [visitor] = await tx.insert(visitors).values({ societyId, name: data.name, phone: data.phone }).returning();
      const [invite] = await tx.insert(visitorInvites).values({
        societyId,
        unitId: unit.id,
        createdBy: sess.userId,
        visitorId: visitor.id,
        code: `WALK${randomInt(100000, 1000000)}`,
        qrToken: randomUUID().replace(/-/g, ""),
        purpose: data.purpose,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 4 * 3600000),
        status: "PENDING",
      }).returning();

      const members = await tx.select({ userId: unitMembers.userId })
        .from(unitMembers)
        .innerJoin(users, eq(users.id, unitMembers.userId))
        .where(and(eq(unitMembers.unitId, unit.id), eq(unitMembers.societyId, societyId)));
      if (members.length) {
        await tx.insert(notifications).values(members.map((member) => ({
          societyId,
          userId: member.userId,
          title: `Visitor at gate: ${data.name}`,
          body: `${data.name} is waiting at the gate. Approve or deny entry in the app.`,
          channel: "IN_APP" as const,
          relatedEntity: "visitor_invite",
          relatedId: invite.id,
        })));
      }
      await audit({ tx, actorId: sess.userId, societyId, action: "guard:manual_pass_pending", entity: "visitor_invite", entityId: invite.id, newState: { invite, visitor } });
      return { invite, visitor, unit, awaitingApproval: true };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    const msg = e.message || "Failed";
    if (msg.includes("Unit not found")) return NextResponse.json({ error: msg, code: "NOT_FOUND" }, { status: 404 });
    if (msg.includes("Gate not valid")) return NextResponse.json({ error: msg, code: "INVALID_GATE" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
