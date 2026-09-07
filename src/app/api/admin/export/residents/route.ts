import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { unitMembers, users, units, buildings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const auth = await requireAuthAndSociety("resident:read");
  if ("error" in auth) return auth.error as any;
  try {
    const { societyId, sess } = auth as any;
    const csv = await withTenant(societyId, sess.userId, async (tx) => {
      const records = await tx
        .select({
          fullName: users.fullName,
          phone: users.phone,
          unitNumber: units.number,
          buildingName: buildings.name,
          relation: unitMembers.relation,
          isPrimary: unitMembers.isPrimary,
        })
        .from(unitMembers)
        .innerJoin(users, eq(users.id, unitMembers.userId))
        .innerJoin(units, eq(units.id, unitMembers.unitId))
        .leftJoin(buildings, eq(buildings.id, units.buildingId))
        .where(eq(unitMembers.societyId, societyId))
        .limit(1000);

      const rows = records.map((r) => [
        r.fullName || "",
        r.phone || "",
        r.unitNumber || "",
        r.buildingName || "",
        r.relation,
        r.isPrimary ? "Primary" : "Secondary",
      ]);

      return toCsv(["Name", "Phone", "Unit", "Building", "Relation", "Primary"], rows);
    });
    return csvResponse(csv, `residents-${societyId}.csv`);
  } catch {
    return new Response("Failed", { status: 500 });
  }
}
