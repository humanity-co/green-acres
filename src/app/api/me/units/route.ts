import { NextResponse } from "next/server";
import { units, unitMembers, buildings, floors } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";

export async function GET() {
  const auth = await requireAuthAndSociety("unit:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) => {
      const rows = await tx
        .select({
          unit: units,
          building: buildings,
          floor: floors,
          relation: unitMembers.relation,
          isPrimary: unitMembers.isPrimary,
        })
        .from(unitMembers)
        .innerJoin(units, eq(units.id, unitMembers.unitId))
        .leftJoin(buildings, eq(buildings.id, units.buildingId))
        .leftJoin(floors, eq(floors.id, units.floorId))
        .where(
          and(
            eq(unitMembers.userId, sess.userId),
            eq(unitMembers.societyId, societyId)
          )
        );

      return rows;
    });

    return NextResponse.json(items);
  } catch (e: any) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
