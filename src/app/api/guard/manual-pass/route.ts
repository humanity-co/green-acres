import { NextResponse } from "next/server";
import { visitors, visitorInvites, visitorEntries, units, gates } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { randomInt } from "crypto";

const schema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  unitId: z.string().uuid(),
  purpose: z.string().min(1).max(200),
  vehicleNumber: z.string().max(20).optional(),
  gateId: z.string().uuid().optional(),
  offlineTimestamp: z.string().optional(),
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
      // 1. Check idempotency
      const existing = await tx
        .select()
        .from(visitorEntries)
        .where(eq(visitorEntries.idempotencyKey, data.idempotencyKey));
      if (existing.length > 0) {
        return existing[0];
      }

      // 2. Validate unit
      const [unit] = await tx
        .select()
        .from(units)
        .where(and(eq(units.id, data.unitId), eq(units.societyId, societyId)));
      if (!unit) throw new Error("Unit not found");

      // 3. Optional gate validation
      if (data.gateId) {
        const [g] = await tx
          .select()
          .from(gates)
          .where(and(eq(gates.id, data.gateId), eq(gates.societyId, societyId)));
        if (!g) throw new Error("Gate not valid at this society");
      }

      // 4. Find or create visitor
      const existingVisitors = await tx
        .select()
        .from(visitors)
        .where(and(eq(visitors.phone, data.phone), eq(visitors.societyId, societyId)));
      let visitorId: string;
      if (existingVisitors.length > 0) {
        visitorId = existingVisitors[0].id;
      } else {
        const [newVisitor] = await tx
          .insert(visitors)
          .values({
            societyId,
            name: data.name,
            phone: data.phone,
          })
          .returning();
        visitorId = newVisitor.id;
      }

      const checkInTime = data.offlineTimestamp ? new Date(data.offlineTimestamp) : new Date();
      const code = `MAN${randomInt(1000, 9999)}`;

      // 5. Create approved emergency invite
      const [invite] = await tx
        .insert(visitorInvites)
        .values({
          societyId,
          unitId: data.unitId,
          createdBy: sess.userId,
          visitorId,
          code,
          purpose: `[OFFLINE MANUAL PASS] ${data.purpose}${data.notes ? ` — ${data.notes}` : ""}`,
          status: "APPROVED",
          approvedBy: sess.userId,
          validFrom: checkInTime,
          validTo: new Date(checkInTime.getTime() + 12 * 3600 * 1000),
        })
        .returning();

      // 6. Record checked-in entry
      const [entry] = await tx
        .insert(visitorEntries)
        .values({
          societyId,
          inviteId: invite.id,
          visitorId,
          unitId: data.unitId,
          gateId: data.gateId || null,
          guardId: sess.userId,
          checkIn: checkInTime,
          idempotencyKey: data.idempotencyKey,
          isOffline: true,
        })
        .returning();

      await audit({
        tx,
        actorId: sess.userId,
        societyId,
        action: "guard:manual_pass_sync",
        entity: "visitor_entry",
        entityId: entry.id,
        newState: {
          ...entry,
          name: data.name,
          phone: data.phone,
          purpose: data.purpose,
        },
      });

      return entry;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    const msg = e.message || "Failed";
    if (msg.includes("Unit not found")) return NextResponse.json({ error: msg, code: "NOT_FOUND" }, { status: 404 });
    if (msg.includes("Gate not valid")) return NextResponse.json({ error: msg, code: "INVALID_GATE" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
