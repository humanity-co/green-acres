import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessions, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
export async function POST() {
  let userId: string | undefined;
  try {
    const store = await cookies();
    const token = store.get("session")?.value;
    if (token) {
      const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
      userId = sess?.userId;
      await db.delete(sessions).where(eq(sessions.token, token));
      if (userId) try { await db.insert(auditLogs).values({ actorId: userId, action: "auth:logout", entity: "session", newState: { revoked: true } }); } catch {}
    }
  } catch {}
  const res = NextResponse.json({ success: true });
  res.cookies.set("session", "", { maxAge: 0, path: "/" });
  res.cookies.set("active_society", "", { maxAge: 0, path: "/" });
  return res;
}
