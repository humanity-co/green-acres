import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { auditLogs } from "@/lib/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
export async function GET(req: Request) {
  const auth = await requireAuthAndSociety("audit:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const action = url.searchParams.get("action");
    const entity = url.searchParams.get("entity");
    const conditions = [eq(auditLogs.societyId, societyId)];
    if (action && action !== "all") conditions.push(eq(auditLogs.action, action));
    if (entity && entity !== "all") conditions.push(eq(auditLogs.entity, entity));

    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const rows = await tx
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r: any) => ({
        id: r.id,
        actorId: r.actorId,
        societyId: r.societyId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        prevState: r.prevState ? JSON.stringify(r.prevState).slice(0, 500) : null,
        newState: r.newState ? JSON.stringify(r.newState).slice(0, 500) : null,
        createdAt: r.createdAt,
      }));
    });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
