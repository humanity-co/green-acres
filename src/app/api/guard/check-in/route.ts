import { NextResponse } from "next/server";
import { visitorInvites, visitors, visitorEntries, gates } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { randomUUID } from "crypto";

const schema = z.object({
  inviteId: z.string().uuid(),
  gateId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid().optional(),
  offlineTimestamp: z.string().optional(),
  isOffline: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("visitor:entry");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;

    const gateId = parsed.data.gateId;
    if (gateId) {
      const gateCheck = await withTenant(societyId, sess.userId, async (tx) => {
        const [g] = await tx.select().from(gates).where(and(eq(gates.id, gateId), eq(gates.societyId, societyId)));
        return !!g;
      });
      if (!gateCheck) return NextResponse.json({ error: "Gate not valid at this society", code: "INVALID_GATE" }, { status: 403 });
    }

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [invite] = await tx.select().from(visitorInvites).where(and(eq(visitorInvites.id, parsed.data.inviteId), eq(visitorInvites.societyId, societyId)));
      if (!invite) throw new Error("Invite not found");
      if (invite.status !== "APPROVED") {
        if (invite.status === "PENDING") {
          throw new Error("Cannot check in: Walk-in is awaiting resident approval");
        }
        throw new Error(`Cannot check in: Invite status is ${invite.status}`);
      }
      const now = new Date();
      if (new Date(invite.validTo) < now) throw new Error("Invite expired");
      if (new Date(invite.validFrom) > now) throw new Error("Invite is not yet valid (future pass)");

      const idempotencyKey = parsed.data.idempotencyKey || randomUUID();
      const existingKey = await tx.select().from(visitorEntries).where(eq(visitorEntries.idempotencyKey, idempotencyKey));
      if (existingKey.length) return existingKey[0];

      const existing = await tx.select().from(visitorEntries).where(eq(visitorEntries.inviteId, invite.id));
      if (existing.some(e => !e.checkOut)) throw new Error("Already checked in");
      const [visitor] = await tx.select().from(visitors).where(eq(visitors.id, invite.visitorId));

      const checkInTime = parsed.data.offlineTimestamp ? new Date(parsed.data.offlineTimestamp) : new Date();

      const [entry] = await tx.insert(visitorEntries).values({
        societyId,
        inviteId: invite.id,
        visitorId: invite.visitorId,
        unitId: invite.unitId,
        gateId: gateId || null,
        guardId: sess.userId,
        checkIn: checkInTime,
        idempotencyKey,
        isOffline: parsed.data.isOffline ?? false,
      }).returning();
      return entry;
    });

    await audit({ actorId: sess.userId, societyId, action: "guard:check_in", entity: "visitor_entry", entityId: (result as any).id, newState: result });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    const msg = e.message || "Failed";
    if (msg.includes("Already checked in")) return NextResponse.json({ error: msg, code: "ALREADY_INSIDE" }, { status: 409 });
    if (msg.includes("not yet valid")) return NextResponse.json({ error: msg, code: "FUTURE_PASS" }, { status: 409 });
    if (msg.includes("expired")) return NextResponse.json({ error: msg, code: "EXPIRED" }, { status: 409 });
    if (msg.includes("not found")) return NextResponse.json({ error: "Invite not found", code: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
