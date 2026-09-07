import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { withTenant } from "@/lib/db/withTenant";
import { userSocietyRoles, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
export async function GET() {
  const auth = await requireAuthAndSociety("admin:overview");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const roles = await tx.select().from(userSocietyRoles).where(eq(userSocietyRoles.societyId, societyId)).limit(100);
      const enriched = await Promise.all(roles.map(async (r) => {
        const [u] = await tx.select().from(users).where(eq(users.id, r.userId));
        return { role: r.role, isActive: r.isActive, user: u ? { id: u.id, fullName: u.fullName, phone: u.phone } : null, societyId: r.societyId };
      }));
      return enriched;
    });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
export async function POST() {
  return NextResponse.json({ error: "Role mutation deferred — read-only in current MVP. Use secure migration for role changes." }, { status: 501 });
}
