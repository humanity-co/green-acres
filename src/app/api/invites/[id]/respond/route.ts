import { NextResponse } from "next/server";
import { visitorInvites, visitors, units, unitMembers, notifications, userSocietyRoles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { z } from "zod";

const respondSchema = z.object({
  action: z.enum(["approve", "deny", "APPROVE", "DENY"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("visitor:approve");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const body = await req.json();
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action. Expected 'approve' or 'deny'" }, { status: 400 });
    }

    const action = parsed.data.action.toUpperCase();
    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [invite] = await tx
        .select()
        .from(visitorInvites)
        .where(and(eq(visitorInvites.id, id), eq(visitorInvites.societyId, societyId)));

      if (!invite) throw new Error("Invite not found");
      if (invite.status !== "PENDING") throw new Error("Invite is no longer pending");
      if (new Date(invite.validTo) < new Date()) throw new Error("Invite has expired");

      // Verify resident belongs to the unit or is privileged admin
      const [member] = await tx
        .select()
        .from(unitMembers)
        .where(
          and(
            eq(unitMembers.userId, sess.userId),
            eq(unitMembers.unitId, invite.unitId),
            eq(unitMembers.societyId, societyId)
          )
        );

      const roles = await tx
        .select({ role: userSocietyRoles.role })
        .from(userSocietyRoles)
        .where(and(eq(userSocietyRoles.userId, sess.userId), eq(userSocietyRoles.societyId, societyId)));

      const isPrivileged = roles.some((r) =>
        ["SUPER_ADMIN", "SOCIETY_ADMIN", "SECURITY_MANAGER"].includes(r.role)
      );

      if (!member && !isPrivileged) throw new Error("Forbidden");

      const [updated] = await tx
        .update(visitorInvites)
        .set({
          status: newStatus,
          approvedBy: sess.userId,
        })
        .where(and(eq(visitorInvites.id, id), eq(visitorInvites.societyId, societyId)))
        .returning();

      const [visitor] = await tx.select().from(visitors).where(eq(visitors.id, invite.visitorId));
      const [unit] = await tx.select().from(units).where(eq(units.id, invite.unitId));

      if (invite.createdBy && invite.createdBy !== sess.userId) {
        await tx.insert(notifications).values({
          societyId,
          userId: invite.createdBy,
          title: `Walk-in ${newStatus === "APPROVED" ? "Approved" : "Denied"}: ${visitor?.name || "Visitor"}`,
          body: `Resident responded to walk-in request for Unit ${unit?.number || ""}: ${newStatus}`,
          channel: "IN_APP",
          relatedEntity: "visitor_invite",
          relatedId: invite.id,
        });
      }

      return { invite: updated, visitor, unit };
    });

    await audit({
      actorId: sess.userId,
      societyId,
      action: `visitor_invite:${newStatus.toLowerCase()}`,
      entity: "visitor_invite",
      entityId: id,
      newState: result.invite,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e.message === "Invite not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.message?.includes("no longer pending") || e.message?.includes("expired")) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
