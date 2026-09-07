import { NextResponse } from "next/server";
import { parkingSlots, unitMembers } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, inArray } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";

export async function GET() {
  const auth = await requireAuthAndSociety("parking:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
    const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN","GUARD","SECURITY_MANAGER"].includes(r));
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      if (isPrivileged) {
        return tx.select().from(parkingSlots).where(eq(parkingSlots.societyId, societyId)).orderBy(desc(parkingSlots.createdAt)).limit(50);
      } else {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (unitIds.length===0) return [];
        return tx.select().from(parkingSlots).where(and(eq(parkingSlots.societyId, societyId), inArray(parkingSlots.unitId, unitIds))).orderBy(desc(parkingSlots.createdAt));
      }
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}
