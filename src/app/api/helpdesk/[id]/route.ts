import { NextResponse } from "next/server";
import { helpdeskTickets, ticketComments, notifications, units, buildings, unitMembers, userSocietyRoles, users } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { getUserRoles } from "@/lib/tenant";
const transitions: Record<string, Record<string, string[]>> = {
  OPEN: {
    RESIDENT: ["CANCELLED"],
    FAMILY_MEMBER: ["CANCELLED"],
    FACILITY_MANAGER: ["ASSIGNED", "CANCELLED"],
    SOCIETY_ADMIN: ["ASSIGNED", "CANCELLED"],
    RWA_MEMBER: ["ASSIGNED"],
    SUPER_ADMIN: ["ASSIGNED", "CANCELLED"],
  },
  ASSIGNED: {
    RESIDENT: ["CANCELLED"],
    FAMILY_MEMBER: ["CANCELLED"],
    FACILITY_MANAGER: ["IN_PROGRESS", "OPEN"],
    SOCIETY_ADMIN: ["IN_PROGRESS", "OPEN"],
    SUPER_ADMIN: ["IN_PROGRESS", "OPEN"],
  },
  IN_PROGRESS: {
    FACILITY_MANAGER: ["RESOLVED"],
    SOCIETY_ADMIN: ["RESOLVED"],
    SUPER_ADMIN: ["RESOLVED"],
  },
  RESOLVED: {
    RESIDENT: ["OPEN", "CLOSED"],
    FAMILY_MEMBER: ["OPEN", "CLOSED"],
    FACILITY_MANAGER: ["OPEN", "CLOSED"],
    SOCIETY_ADMIN: ["OPEN", "CLOSED"],
    SUPER_ADMIN: ["OPEN", "CLOSED"],
  },
  CLOSED: {
    SOCIETY_ADMIN: ["OPEN"],
    SUPER_ADMIN: ["OPEN"],
  },
  CANCELLED: {
    SOCIETY_ADMIN: ["OPEN"],
    SUPER_ADMIN: ["OPEN"],
  },
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("ticket:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const roles = await getUserRoles(sess.userId, societyId);
    const isStaff = roles.some((r: string) => ["SOCIETY_ADMIN","RWA_MEMBER","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const [ticket] = await tx.select().from(helpdeskTickets).where(and(eq(helpdeskTickets.id, id), eq(helpdeskTickets.societyId, societyId)));
      if (!ticket) throw new Error("Not found");
      if (!isStaff) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m => m.unitId);
        const isOwner = ticket.raisedBy === sess.userId || unitIds.includes(ticket.unitId);
        if (!isOwner) throw new Error("Forbidden");
      }

      // Enrich ticket with unit, building, raisedBy, assignee
      let unitData = null;
      if (ticket.unitId) {
        const [u] = await tx
          .select({
            id: units.id,
            number: units.number,
            type: units.type,
            buildingId: units.buildingId,
          })
          .from(units)
          .where(eq(units.id, ticket.unitId));

        if (u) {
          let bName = null;
          if (u.buildingId) {
            const [b] = await tx
              .select({ name: buildings.name })
              .from(buildings)
              .where(eq(buildings.id, u.buildingId));
            bName = b?.name || null;
          }
          unitData = {
            id: u.id,
            number: u.number,
            type: u.type,
            buildingName: bName,
          };
        }
      }

      let authorData = null;
      if (ticket.raisedBy) {
        const [u] = await tx
          .select({ id: users.id, fullName: users.fullName, phone: users.phone })
          .from(users)
          .where(eq(users.id, ticket.raisedBy));
        authorData = u || null;
      }

      let assigneeData = null;
      if (ticket.assigneeId) {
        const [u] = await tx
          .select({ id: users.id, fullName: users.fullName, phone: users.phone })
          .from(users)
          .where(eq(users.id, ticket.assigneeId));
        assigneeData = u || null;
      }

      const comments = await tx
        .select()
        .from(ticketComments)
        .where(eq(ticketComments.ticketId, id))
        .orderBy(desc(ticketComments.createdAt));

      const enrichedComments = await Promise.all(
        comments.map(async (c) => {
          const [u] = await tx
            .select({ id: users.id, fullName: users.fullName, phone: users.phone })
            .from(users)
            .where(eq(users.id, c.authorId));

          const [usr] = await tx
            .select({ role: userSocietyRoles.role })
            .from(userSocietyRoles)
            .where(and(eq(userSocietyRoles.userId, c.authorId), eq(userSocietyRoles.societyId, societyId)));

          return {
            ...c,
            author: u ? { id: u.id, fullName: u.fullName, phone: u.phone, role: usr?.role || "MEMBER" } : null,
          };
        })
      );

      return {
        ticket: {
          ...ticket,
          unit: unitData,
          author: authorData,
          assignee: assigneeData,
        },
        comments: enrichedComments,
      };
    });
    return NextResponse.json(data);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("ticket:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, assigneeId, priority, category } = body;
    const { societyId, sess } = auth as any;
    const roles = await getUserRoles(sess.userId, societyId);

    const isStaff = roles.some((r: string) => ["SOCIETY_ADMIN", "RWA_MEMBER", "FACILITY_MANAGER", "SUPER_ADMIN"].includes(r));

    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [ticket] = await tx.select().from(helpdeskTickets).where(and(eq(helpdeskTickets.id, id), eq(helpdeskTickets.societyId, societyId)));
      if (!ticket) throw new Error("Not found");

      const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
      const unitIds = members.map((m) => m.unitId);
      const isOwner = ticket.raisedBy === sess.userId || unitIds.includes(ticket.unitId);

      // Only staff can update assignee, priority, or category
      if (assigneeId !== undefined || priority !== undefined || category !== undefined) {
        if (!isStaff) {
          throw new Error("Forbidden: Only staff can modify ticket assignee, priority, or category");
        }
      }

      const patch: any = {};
      if (status) {
        if (!isStaff && !isOwner) {
          throw new Error("Forbidden: Only ticket owner or staff can change ticket status");
        }

        // Collect allowed target statuses
        const allowedTargets = new Set<string>();
        if (isStaff) {
          for (const role of roles) {
            const allowed = transitions[ticket.status]?.[role] || [];
            for (const s of allowed) allowedTargets.add(s);
          }
        } else if (isOwner) {
          const ownerAllowed = transitions[ticket.status]?.["RESIDENT"] || [];
          for (const s of ownerAllowed) allowedTargets.add(s);
        }

        if (!allowedTargets.has(status)) {
          if (!isStaff) {
            throw new Error(`Forbidden: Residents cannot transition ticket from ${ticket.status} to ${status}`);
          }
          throw new Error(`Cannot transition ticket from ${ticket.status} to ${status} with your role`);
        }
        patch.status = status;
      }
      if (assigneeId !== undefined) {
        if (assigneeId) {
          const [assignee] = await tx.select().from(users).where(eq(users.id, assigneeId));
          if (!assignee) throw new Error("Assignee not found");
          const asgnRoles = await tx.select().from(userSocietyRoles).where(and(eq(userSocietyRoles.userId, assigneeId), eq(userSocietyRoles.societyId, societyId)));
          if (asgnRoles.length === 0) throw new Error("Assignee not in society");
          const allowed = asgnRoles.some(r => ["SOCIETY_ADMIN","RWA_MEMBER","FACILITY_MANAGER","SECURITY_MANAGER","SUPER_ADMIN","SERVICE_PROVIDER","VENDOR"].includes(r.role));
          if (!allowed) throw new Error("Assignee not authorized");
          patch.assigneeId = assigneeId;
        } else {
          patch.assigneeId = null;
        }
      }
      if (priority) {
        if (!["LOW","MEDIUM","HIGH","URGENT"].includes(priority)) throw new Error("Invalid priority");
        patch.priority = priority;
      }
      if (category) patch.category = category;
      if (Object.keys(patch).length === 0) return ticket;
      const [upd] = await tx.update(helpdeskTickets).set(patch).where(and(eq(helpdeskTickets.id, id), eq(helpdeskTickets.societyId, societyId))).returning();

      // System activity logging in comments
      const [actor] = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, sess.userId));
      const actorName = actor?.fullName || "Staff";
      let systemNote = "";
      if (status && status !== ticket.status) {
        systemNote += `Status changed from ${ticket.status} to ${status} by ${actorName}. `;
      }
      if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
        if (assigneeId) {
          const [asgn] = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, assigneeId));
          systemNote += `Assigned to ${asgn?.fullName || "Staff"}.`;
        } else {
          systemNote += `Unassigned.`;
        }
      }
      if (systemNote) {
        try {
          const { ownerDb } = await import("@/lib/db");
          await ownerDb.insert(ticketComments).values({
            ticketId: id,
            authorId: sess.userId,
            body: `[Activity] ${systemNote.trim()}`,
          });
        } catch (actErr) {
          console.warn("Non-blocking activity log skipped:", actErr);
        }
      }

      if (status) {
        await tx.insert(notifications).values({
          societyId,
          userId: ticket.raisedBy,
          title: `Ticket ${status}: ${ticket.title.slice(0,30)}`,
          body: `Status changed to ${status}`,
          channel: "IN_APP",
          relatedEntity: "ticket",
          relatedId: ticket.id,
        });
      }
      if (assigneeId) {
        await tx.insert(notifications).values({
          societyId,
          userId: assigneeId,
          title: `Assigned ticket: ${ticket.title.slice(0,30)}`,
          body: `You have been assigned`,
          channel: "IN_APP",
          relatedEntity: "ticket",
          relatedId: ticket.id,
        });
        await tx.insert(notifications).values({
          societyId,
          userId: ticket.raisedBy,
          title: `Ticket assigned: ${ticket.title.slice(0,30)}`,
          body: `Assigned to staff`,
          channel: "IN_APP",
          relatedEntity: "ticket",
          relatedId: ticket.id,
        });
      }
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action: "update", entity: "ticket", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.message === "Forbidden" || e.message.startsWith("Forbidden")) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e.message.startsWith("Cannot transition ticket") || e.message.startsWith("Invalid transition")) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message === "Assignee not found" || e.message === "Assignee not in society" || e.message === "Assignee not authorized") return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message === "Invalid priority") return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
