import { NextResponse } from "next/server";
import { vehicles, units, users } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, ilike, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { maskPhone } from "@/lib/privacy";

export async function GET(req: Request) {
  const auth = await requireAuthAndSociety("vehicle:entry");
  if ("error" in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length<2) return NextResponse.json([]);
    const normalized = q.replace(/\s+/g, "").toUpperCase();
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      const vs = await tx.select().from(vehicles).where(and(eq(vehicles.societyId, societyId), ilike(vehicles.numberPlate, `%${normalized}%`))).limit(10);
      const enriched = await Promise.all(vs.map(async v=>{
        const [unit] = await tx.select().from(units).where(eq(units.id, v.unitId));
        const [user] = await tx.select().from(users).where(eq(users.id, v.userId));
        return { vehicle: v, unit, owner: user ? { id: user.id, fullName: user.fullName, phone: maskPhone(user.phone) } : null };
      }));
      if (enriched.length===0) {
        const us = await tx.select().from(units).where(and(eq(units.societyId, societyId), ilike(units.number, `%${q}%`))).limit(5);
        const byUnit = await Promise.all(us.map(async u=>{
          const vs2 = await tx.select().from(vehicles).where(and(eq(vehicles.societyId, societyId), eq(vehicles.unitId, u.id))).limit(5);
          return vs2.map(v=>({ vehicle: v, unit: u }));
        }));
        return byUnit.flat();
      }
      return enriched;
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}
