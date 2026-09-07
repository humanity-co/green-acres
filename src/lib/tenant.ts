import { cookies } from "next/headers";
import { db, ownerDb } from "@/lib/db";
import { userSocietyRoles, units } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "./auth/session";
import crypto from "crypto";

export async function getAuthorizedSocietyId(): Promise<string | null> {
  const sess = await getSession();
  if (!sess) return null;
  const store = await cookies();
  const rawValue = store.get("active_society")?.value;
  let active: string | null = null;

  if (rawValue) {
    if (rawValue.includes(".")) {
      const [id, sig] = rawValue.split(".");
      const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-32chars-long-change-me-fallback-only-dev";
      const expectedSig = crypto.createHmac("sha256", secret).update(id).digest("hex");
      if (sig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        active = id;
      }
    } else {
      active = rawValue;
    }
  }

  const roles = await ownerDb.select().from(userSocietyRoles).where(eq(userSocietyRoles.userId, sess.userId));
  if (roles.length === 0) return null;
  if (active && roles.some(r => r.societyId === active)) return active;
  return roles[0].societyId;
}

export async function requireSocietyId(): Promise<string> {
  const id = await getAuthorizedSocietyId();
  if (!id) throw new Error("No authorized society");
  return id;
}

export async function verifyUnitBelongsToSociety(unitId: string, societyId: string) {
  const [unit] = await ownerDb.select().from(units).where(and(eq(units.id, unitId), eq(units.societyId, societyId)));
  if (!unit) throw new Error("Unit does not belong to society");
  return unit;
}

export async function getUserRoles(userId: string, societyId: string) {
  const rows = await ownerDb.select().from(userSocietyRoles).where(and(eq(userSocietyRoles.userId, userId), eq(userSocietyRoles.societyId, societyId)));
  return rows.map(r => r.role);
}
