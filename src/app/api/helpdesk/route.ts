import { NextResponse } from "next/server";
import { helpdeskTickets, units, buildings, users, unitMembers, notifications, userSocietyRoles } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, desc, and, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
import { getUserRoles } from "@/lib/tenant";
const createSchema = z.object({
  unitId: z.string().uuid(),
  category: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["LOW","MEDIUM","HIGH","URGENT"]).optional(),
});
export async function GET(req: Request) {
  const auth = await requireAuthAndSociety("ticket:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const category = url.searchParams.get("category");
    const unitId = url.searchParams.get("unitId");
    const assigneeId = url.searchParams.get("assigneeId");
    const roles = await getUserRoles(sess.userId, societyId);
    const isStaff = roles.some((r: string) => ["SOCIETY_ADMIN","RWA_MEMBER","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));

    const filterConditions: any[] = [];
    if (status) filterConditions.push(eq(helpdeskTickets.status, status as any));
    if (priority) filterConditions.push(eq(helpdeskTickets.priority, priority as any));
    if (category) filterConditions.push(eq(helpdeskTickets.category, category));
    if (unitId) filterConditions.push(eq(helpdeskTickets.unitId, unitId));
    if (assigneeId) filterConditions.push(eq(helpdeskTickets.assigneeId, assigneeId));

    const items = await withTenant(societyId, sess.userId, async (tx) => {
      let ticketsQuery;
      if (!isStaff) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m => m.unitId);
        const scopeCondition = unitIds.length > 0
          ? or(eq(helpdeskTickets.raisedBy, sess.userId), inArray(helpdeskTickets.unitId, unitIds))
          : eq(helpdeskTickets.raisedBy, sess.userId);

        ticketsQuery = await tx
          .select()
          .from(helpdeskTickets)
          .where(and(eq(helpdeskTickets.societyId, societyId), scopeCondition, ...filterConditions))
          .orderBy(desc(helpdeskTickets.createdAt))
          .limit(50);
      } else {
        ticketsQuery = await tx
          .select()
          .from(helpdeskTickets)
          .where(and(eq(helpdeskTickets.societyId, societyId), ...filterConditions))
          .orderBy(desc(helpdeskTickets.createdAt))
          .limit(50);
      }

      // Enrich tickets with unit, building, raisedBy user, and assignee user details
      const enriched = await Promise.all(
        ticketsQuery.map(async (t) => {
          let unitData = null;
          let authorData = null;
          let assigneeData = null;

          if (t.unitId) {
            const [u] = await tx
              .select({
                id: units.id,
                number: units.number,
                type: units.type,
                buildingId: units.buildingId,
              })
              .from(units)
              .where(eq(units.id, t.unitId));

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

          if (t.raisedBy) {
            const [u] = await tx
              .select({ id: users.id, fullName: users.fullName, phone: users.phone })
              .from(users)
              .where(eq(users.id, t.raisedBy));
            authorData = u || null;
          }

          if (t.assigneeId) {
            const [u] = await tx
              .select({ id: users.id, fullName: users.fullName, phone: users.phone })
              .from(users)
              .where(eq(users.id, t.assigneeId));
            assigneeData = u || null;
          }

          return {
            ...t,
            unit: unitData,
            author: authorData,
            assignee: assigneeData,
          };
        })
      );

      return enriched;
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("ticket:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    const { societyId, sess } = auth as any;
    const item = await withTenant(societyId, sess.userId, async (tx) => {
      const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, parsed.data.unitId), eq(unitMembers.societyId, societyId)));
      if (members.length === 0) {
        const [unit] = await tx.select().from(units).where(and(eq(units.id, parsed.data.unitId), eq(units.societyId, societyId)));
        if (!unit) throw new Error("Unit not in society");
        const isStaff = (await getUserRoles(sess.userId, societyId)).some((r:string)=>["SOCIETY_ADMIN","RWA_MEMBER","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
        if (!isStaff) throw new Error("Unit not authorized");
      }

      const priority = parsed.data.priority || "MEDIUM";
      const slaHoursMap: Record<string, number> = {
        URGENT: 4,
        HIGH: 24,
        MEDIUM: 48,
        LOW: 72,
      };
      const hours = slaHoursMap[priority] || 48;
      const slaDue = new Date(Date.now() + hours * 60 * 60 * 1000);

      const [created] = await tx.insert(helpdeskTickets).values({
        societyId,
        unitId: parsed.data.unitId,
        raisedBy: sess.userId,
        category: parsed.data.category,
        title: parsed.data.title,
        description: parsed.data.description || null,
        priority,
        status: "OPEN",
        slaDue,
      }).returning();

      // Notify ticket author
      await tx.insert(notifications).values({
        societyId,
        userId: sess.userId,
        title: `Ticket created: ${parsed.data.title.slice(0, 40)}`,
        body: `Category ${parsed.data.category} • Priority ${parsed.data.priority || "MEDIUM"}`,
        channel: "IN_APP",
        relatedEntity: "ticket",
        relatedId: created.id,
      });

      // Notify society facility managers / admins
      const staffMembers = await tx
        .select({ userId: userSocietyRoles.userId })
        .from(userSocietyRoles)
        .where(
          and(
            eq(userSocietyRoles.societyId, societyId),
            inArray(userSocietyRoles.role, ["FACILITY_MANAGER", "SOCIETY_ADMIN", "RWA_MEMBER"])
          )
        );

      const uniqueStaffIds = Array.from(new Set(staffMembers.map((s) => s.userId))).filter(
        (id) => id !== sess.userId
      );

      for (const staffId of uniqueStaffIds) {
        await tx.insert(notifications).values({
          societyId,
          userId: staffId,
          title: `New complaint: ${parsed.data.title.slice(0, 40)}`,
          body: `Category ${parsed.data.category} • Priority ${parsed.data.priority || "MEDIUM"}`,
          channel: "IN_APP",
          relatedEntity: "ticket",
          relatedId: created.id,
        });
      }

      return created;
    });
    await audit({ actorId: sess.userId, societyId, action: "create", entity: "ticket", entityId: item.id, newState: item });
    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    if (e.message === "Unit not in society" || e.message === "Unit not authorized") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
