import { NextResponse } from "next/server";
import { visitorInvites, visitors, units, visitorEntries } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, or, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { maskPhone } from "@/lib/privacy";

const schema = z.object({ code: z.string().min(2).max(64) });

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("visitor:entry");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    const code = parsed.data.code.trim().toUpperCase();
    const { societyId, sess } = auth as any;

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [invite] = await tx.select().from(visitorInvites).where(and(eq(visitorInvites.societyId, societyId), or(eq(visitorInvites.code, code), eq(visitorInvites.qrToken, code))));
      if (!invite) return null;
      const [visitor] = await tx.select().from(visitors).where(eq(visitors.id, invite.visitorId));
      const [unit] = await tx.select().from(units).where(eq(units.id, invite.unitId));
      const existing = await tx.select().from(visitorEntries).where(eq(visitorEntries.inviteId, invite.id));
      const isInside = existing.some(e => !e.checkOut);
      return { invite, visitor, unit, entries: existing, isInside };
    });

    if (!result) return NextResponse.json({ error: "Visitor pass not found", code: "NOT_FOUND" }, { status: 404 });

    const { invite, visitor, unit, isInside } = result;
    const maskedVisitor = visitor ? { ...visitor, phone: maskPhone(visitor.phone) } : visitor;
    const now = new Date();

    if (invite.status === "CANCELLED") return NextResponse.json({ error: "This visitor invitation was cancelled", code: "CANCELLED", invite, visitor: maskedVisitor, unit }, { status: 409 });
    if (invite.status === "REJECTED") return NextResponse.json({ error: "This invitation was rejected", code: "REJECTED", invite, visitor: maskedVisitor, unit }, { status: 409 });
    if (invite.status === "EXPIRED" || new Date(invite.validTo) < now) return NextResponse.json({ error: "This visitor pass has expired", code: "EXPIRED", invite, visitor: maskedVisitor, unit }, { status: 409 });
    if (new Date(invite.validFrom) > now) {
      return NextResponse.json({
        error: "This visitor pass is scheduled for a future time",
        code: "FUTURE_PASS",
        status: "FUTURE_PASS",
        invite,
        visitor: maskedVisitor,
        unit,
      }, { status: 409 });
    }
    if (invite.status === "PENDING") {
      return NextResponse.json({
        invite,
        visitor: maskedVisitor,
        unit,
        status: "PENDING_APPROVAL",
        message: "Pass is awaiting resident approval",
        isInside: false,
      });
    }
    if (invite.status !== "APPROVED") return NextResponse.json({ error: "Invitation not in valid state", code: "INVALID_STATUS", invite, visitor: maskedVisitor, unit }, { status: 409 });

    if (isInside) {
      return NextResponse.json({
        invite,
        visitor: maskedVisitor,
        unit,
        status: "ALREADY_INSIDE",
        isInside: true,
        message: "Visitor is currently inside premises",
      });
    }

    await audit({ actorId: sess.userId, societyId, action: "guard:verify", entity: "visitor_invite", entityId: invite.id, newState: { code } });

    return NextResponse.json({ invite, visitor: maskedVisitor, unit, status: "READY", isInside: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
