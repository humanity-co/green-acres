import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { auditLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { toCsv, csvResponse } from "@/lib/csv";
export async function GET() {
  const auth = await requireAuthAndSociety("audit:read");
  if ("error" in auth) return auth.error as any;
  try {
    const { societyId, sess } = auth as any;
    const csv = await withTenant(societyId, sess.userId, async (tx) => {
      const rows = await tx.select().from(auditLogs).where(eq(auditLogs.societyId, societyId)).orderBy(desc(auditLogs.createdAt)).limit(200);
      const data = rows.map(r => [r.actorId?.slice(0,8) || "", r.action, r.entity, r.entityId?.slice(0,8) || "", r.createdAt.toISOString()]);
      return toCsv(["Actor", "Action", "Entity", "EntityId", "Timestamp"], data);
    });
    return csvResponse(csv, `audit-${societyId}.csv`);
  } catch { return new Response("Failed", { status: 500 }); }
}
