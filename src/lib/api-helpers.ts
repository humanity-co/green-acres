import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedSocietyId, getUserRoles } from "@/lib/tenant";
import { can } from "@/lib/auth/rbac";

export async function requireAuthAndSociety(permission?: string) {
  const sess = await getSession();
  if (!sess) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const societyId = await getAuthorizedSocietyId();
  if (!societyId) return { error: NextResponse.json({ error: "No society membership" }, { status: 403 }) };
  if (permission) {
    const roles = await getUserRoles(sess.userId, societyId) as any;
    if (!can(roles, permission)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { sess, societyId };
}
