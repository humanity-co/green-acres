import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { units, buildings, floors, unitMembers, vehicles } from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export async function GET(req: Request) {
  const auth = await requireAuthAndSociety("resident:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const buildingId = url.searchParams.get("buildingId");

    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const conditions = [eq(units.societyId, societyId)];
      if (buildingId) {
        conditions.push(eq(units.buildingId, buildingId));
      }

      const rows = await tx
        .select()
        .from(units)
        .where(and(...conditions))
        .orderBy(desc(units.createdAt))
        .limit(limit)
        .offset(offset);

      if (rows.length === 0) return [];

      const buildingIds = Array.from(new Set(rows.map((u) => u.buildingId).filter(Boolean))) as string[];
      const floorIds = Array.from(new Set(rows.map((u) => u.floorId).filter(Boolean))) as string[];
      const unitIds = rows.map((u) => u.id);

      const [buildingList, floorList, memberCounts, vehicleCounts] = await Promise.all([
        buildingIds.length > 0
          ? tx.select().from(buildings).where(inArray(buildings.id, buildingIds))
          : Promise.resolve([]),
        floorIds.length > 0
          ? tx.select().from(floors).where(inArray(floors.id, floorIds))
          : Promise.resolve([]),
        tx
          .select({
            unitId: unitMembers.unitId,
            count: sql<number>`count(*)::int`,
          })
          .from(unitMembers)
          .where(inArray(unitMembers.unitId, unitIds))
          .groupBy(unitMembers.unitId),
        tx
          .select({
            unitId: vehicles.unitId,
            count: sql<number>`count(*)::int`,
          })
          .from(vehicles)
          .where(inArray(vehicles.unitId, unitIds))
          .groupBy(vehicles.unitId),
      ]);

      const buildingMap = new Map(buildingList.map((b) => [b.id, b]));
      const floorMap = new Map(floorList.map((f) => [f.id, f]));
      const memberCountMap = new Map(memberCounts.map((m) => [m.unitId, m.count]));
      const vehicleCountMap = new Map(vehicleCounts.map((v) => [v.unitId, v.count]));

      return rows.map((u) => ({
        unit: u,
        building: buildingMap.get(u.buildingId) || null,
        floor: floorMap.get(u.floorId) || null,
        memberCount: memberCountMap.get(u.id) || 0,
        vehicleCount: vehicleCountMap.get(u.id) || 0,
      }));
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[ADMIN UNITS ERROR]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
