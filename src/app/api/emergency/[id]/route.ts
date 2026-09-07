import { NextResponse } from "next/server";
import { emergencyAlerts } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

// Role-based state machine for emergency transitions.
// Guards can acknowledge and respond — they are at the gate and physically
// engaged. Only senior roles can resolve or dismiss an alert.
const ALLOWED_TRANSITIONS: Record<string, Record<string, string[]>> = {
  OPEN: {
    GUARD:            ["ACKNOWLEDGED"],
    SECURITY_MANAGER: ["ACKNOWLEDGED", "RESOLVED"],
    SOCIETY_ADMIN:    ["ACKNOWLEDGED", "RESOLVED", "DISMISSED"],
    RWA_MEMBER:       ["ACKNOWLEDGED"],
    SUPER_ADMIN:      ["ACKNOWLEDGED", "RESOLVED", "DISMISSED"],
  },
  ACKNOWLEDGED: {
    GUARD:            ["RESPONDED"],
    SECURITY_MANAGER: ["RESPONDED", "RESOLVED"],
    SOCIETY_ADMIN:    ["RESPONDED", "RESOLVED"],
    SUPER_ADMIN:      ["RESPONDED", "RESOLVED", "DISMISSED"],
  },
  RESPONDED: {
    GUARD:            [],
    SECURITY_MANAGER: ["RESOLVED"],
    SOCIETY_ADMIN:    ["RESOLVED"],
    SUPER_ADMIN:      ["RESOLVED", "DISMISSED"],
  },
  RESOLVED:  {},
  DISMISSED: {},
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("emergency:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, resolutionNotes } = body;

    const validStatuses = ["OPEN", "ACKNOWLEDGED", "RESPONDED", "RESOLVED", "DISMISSED"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    const { societyId, sess } = auth as any;
    // Get all roles the user holds in this society for the transition check
    const { userSocietyRoles } = await import("@/lib/db/schema");
    const roleRows = await (await import("@/lib/db")).db
      .select({ role: userSocietyRoles.role })
      .from(userSocietyRoles)
      .where(and(eq(userSocietyRoles.userId, sess.userId), eq(userSocietyRoles.societyId, societyId)));
    const userRoles = roleRows.map(r => r.role);

    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(emergencyAlerts)
        .where(and(eq(emergencyAlerts.id, id), eq(emergencyAlerts.societyId, societyId)));
      if (!existing) throw new Error("Not found");

      // Check if ANY of the user's roles permit this transition
      const allowedForUser = new Set<string>();
      for (const role of userRoles) {
        for (const s of (ALLOWED_TRANSITIONS[existing.status]?.[role] ?? [])) {
          allowedForUser.add(s);
        }
      }
      if (!allowedForUser.has(status)) {
        throw Object.assign(new Error("Forbidden transition"), { code: "FORBIDDEN_TRANSITION" });
      }

      // Build patch with automatic timestamps
      const now = new Date();
      const patch: any = { status };
      if (status === "ACKNOWLEDGED") {
        patch.acknowledgedBy = sess.userId;
        patch.acknowledgedAt = now;
      }
      if (status === "RESPONDED") {
        patch.respondedBy = sess.userId;
        patch.respondedAt = now;
        // Also set acknowledgedBy/At if jumping straight to RESPONDED
        if (!existing.acknowledgedBy) {
          patch.acknowledgedBy = sess.userId;
          patch.acknowledgedAt = now;
        }
      }
      if (status === "RESOLVED" || status === "DISMISSED") {
        patch.resolvedAt = now;
        if (resolutionNotes) patch.resolutionNotes = String(resolutionNotes).slice(0, 1000);
      }

      const [upd] = await tx.update(emergencyAlerts)
        .set(patch)
        .where(and(eq(emergencyAlerts.id, id), eq(emergencyAlerts.societyId, societyId)))
        .returning();
      return upd;
    });

    await audit({
      actorId: sess.userId,
      societyId,
      action: `emergency.${status.toLowerCase()}`,
      entity: "emergency_alert",
      entityId: id,
      newState: updated,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.code === "FORBIDDEN_TRANSITION") {
      return NextResponse.json({ error: `Your role cannot perform this transition on the current alert status` }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
