import { NextResponse } from "next/server";
import { helpdeskTickets, ticketComments, notifications, unitMembers, users, userSocietyRoles } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { getUserRoles } from "@/lib/tenant";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("ticket:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const roles = await getUserRoles(sess.userId, societyId);
    const isStaff = roles.some((r: string) => ["SOCIETY_ADMIN","RWA_MEMBER","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
    const comments = await withTenant(societyId, sess.userId, async (tx) => {
      const [ticket] = await tx.select().from(helpdeskTickets).where(and(eq(helpdeskTickets.id, id), eq(helpdeskTickets.societyId, societyId)));
      if (!ticket) throw new Error("Not found");
      if (!isStaff) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m => m.unitId);
        const isOwner = ticket.raisedBy === sess.userId || unitIds.includes(ticket.unitId);
        if (!isOwner) throw new Error("Forbidden");
      }
      const list = await tx.select().from(ticketComments).where(eq(ticketComments.ticketId, id)).orderBy(desc(ticketComments.createdAt));
      return await Promise.all(
        list.map(async (c) => {
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
    });
    return NextResponse.json(comments);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
const schema = z.object({ body: z.string().min(1).max(2000) });
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("ticket:comment");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;
    const roles = await getUserRoles(sess.userId, societyId);
    const isStaff = roles.some((r: string) => ["SOCIETY_ADMIN","RWA_MEMBER","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
    const comment = await withTenant(societyId, sess.userId, async (tx) => {
      const [ticket] = await tx.select().from(helpdeskTickets).where(and(eq(helpdeskTickets.id, id), eq(helpdeskTickets.societyId, societyId)));
      if (!ticket) throw new Error("Not found");
      if (!isStaff) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m => m.unitId);
        const isOwner = ticket.raisedBy === sess.userId || unitIds.includes(ticket.unitId);
        if (!isOwner) throw new Error("Forbidden");
      }
      const { ownerDb } = await import("@/lib/db");
      const [created] = await ownerDb.insert(ticketComments).values({ ticketId: id, authorId: sess.userId, body: parsed.data.body }).returning();

      const recipients = new Set<string>();
      if (ticket.raisedBy !== sess.userId) {
        recipients.add(ticket.raisedBy);
      }
      if (ticket.assigneeId && ticket.assigneeId !== sess.userId) {
        recipients.add(ticket.assigneeId);
      }

      for (const recipientId of recipients) {
        const isAuthor = recipientId === ticket.raisedBy;
        await tx.insert(notifications).values({
          societyId,
          userId: recipientId,
          title: isAuthor ? `Update on ${ticket.title.slice(0, 30)}` : `New comment on ${ticket.title.slice(0, 30)}`,
          body: parsed.data.body.slice(0, 100),
          channel: "IN_APP",
          relatedEntity: "ticket",
          relatedId: ticket.id,
        });
      }
      return created;
    });
    await audit({ actorId: sess.userId, societyId, action: "comment", entity: "ticket", entityId: id, newState: { body: parsed.data.body } });
    return NextResponse.json(comment, { status: 201 });
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
