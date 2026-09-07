import { NextResponse } from "next/server";
import { units, users, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, ilike, inArray } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { maskPhone } from "@/lib/privacy";

export async function GET(req: Request) {
  const auth = await requireAuthAndSociety("visitor:entry");
  if ("error" in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) return NextResponse.json([]);
    const { societyId, sess } = auth as any;

    const items = await withTenant(societyId, sess.userId, async (tx) => {
      // 1. Search units in this society matching flat number
      const matchingUnits = await tx
        .select()
        .from(units)
        .where(and(eq(units.societyId, societyId), ilike(units.number, `%${q}%`)))
        .limit(10);

      // 2. Search users who have memberships IN THIS SOCIETY matching name
      // Scoped strictly through unitMembers to prevent cross-tenant PII exposure
      const societyMembers = await tx
        .select({
          unitId: unitMembers.unitId,
          userId: unitMembers.userId,
          fullName: users.fullName,
        })
        .from(unitMembers)
        .innerJoin(users, eq(unitMembers.userId, users.id))
        .where(and(eq(unitMembers.societyId, societyId), ilike(users.fullName, `%${q}%`)))
        .limit(10);

      const unitIdSet = new Set<string>([
        ...matchingUnits.map((u) => u.id),
        ...societyMembers.map((m) => m.unitId),
      ]);

      if (unitIdSet.size === 0) return [];
      const unitIds = Array.from(unitIdSet).slice(0, 10);

      // Batch load target units
      const targetUnits = await tx
        .select()
        .from(units)
        .where(and(eq(units.societyId, societyId), inArray(units.id, unitIds)));

      // Batch load all members for these units
      const allMembers = await tx
        .select()
        .from(unitMembers)
        .where(and(eq(unitMembers.societyId, societyId), inArray(unitMembers.unitId, unitIds)));

      const memberUserIds = Array.from(new Set(allMembers.map((m) => m.userId)));
      const allUsers = memberUserIds.length
        ? await tx.select().from(users).where(inArray(users.id, memberUserIds))
        : [];
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      return targetUnits.map((u) => {
        const residents = allMembers
          .filter((m) => m.unitId === u.id)
          .map((m) => {
            const user = userMap.get(m.userId);
            return {
              ...m,
              user: user
                ? { id: user.id, fullName: user.fullName, phone: maskPhone(user.phone) }
                : null,
            };
          });
        return { unit: u, residents };
      });
    });

    return NextResponse.json(items);
  } catch (e: any) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
