import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, userSocietyRoles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthorizedSocietyId } from "@/lib/tenant";

export async function GET() {
  try {
    const sess = await getSession();
    if (!sess) return NextResponse.json({ user: null }, { status: 401 });
    const societyId = await getAuthorizedSocietyId();
    if (!societyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [user] = await db.select().from(users).where(eq(users.id, sess.userId));
    const roles = await db
      .select()
      .from(userSocietyRoles)
      .where(
        and(
          eq(userSocietyRoles.userId, sess.userId),
          eq(userSocietyRoles.societyId, societyId)
        )
      );
    return NextResponse.json({ user, roles, session: sess });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
