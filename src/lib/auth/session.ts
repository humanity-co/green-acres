import { cookies } from "next/headers";
import { verifyJwt } from "./jwt";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
export async function getSession() {
  const store = await cookies();
  const token = store.get("session")?.value;
  if (!token) return null;
  try {
    const payload = await verifyJwt(token);
    const [row] = await db.select().from(sessions).where(eq(sessions.token, token));
    if (!row) return null;
    if (row.expiresAt < new Date()) {
      await db.delete(sessions).where(eq(sessions.token, token));
      return null;
    }
    return payload as { userId: string; phone: string; exp: number };
  } catch { return null; }
}
export async function requireAuth() {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}
