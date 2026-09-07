import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { unitMembers, users, units, buildings, floors } from "@/lib/db/schema";
import { eq, and, desc, or, ilike } from "drizzle-orm";

export async function GET(req: Request) {
  const auth = await requireAuthAndSociety("resident:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const q = url.searchParams.get("q")?.trim() || "";

    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const conditions: any[] = [eq(unitMembers.societyId, societyId)];
      if (q) {
        conditions.push(
          or(
            ilike(users.fullName, `%${q}%`),
            ilike(users.phone, `%${q}%`),
            ilike(units.number, `%${q}%`)
          )
        );
      }

      const rows = await tx
        .select({
          member: unitMembers,
          user: {
            id: users.id,
            fullName: users.fullName,
            phone: users.phone,
          },
          unit: {
            id: units.id,
            number: units.number,
            type: units.type,
          },
          building: {
            id: buildings.id,
            name: buildings.name,
          },
          floor: {
            id: floors.id,
            number: floors.number,
          },
        })
        .from(unitMembers)
        .innerJoin(users, eq(users.id, unitMembers.userId))
        .innerJoin(units, eq(units.id, unitMembers.unitId))
        .leftJoin(buildings, eq(buildings.id, units.buildingId))
        .leftJoin(floors, eq(floors.id, units.floorId))
        .where(and(...conditions))
        .orderBy(desc(unitMembers.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r) => ({
        member: r.member,
        user: r.user,
        unit: r.unit,
        building: r.building?.id ? r.building : null,
        floor: r.floor?.id ? r.floor : null,
      }));
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
