import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { otpCodes, users, sessions } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signJwt } from "@/lib/auth/jwt";
import { z } from "zod";
const schema = z.object({ phone: z.string().min(10).max(20), code: z.string().length(6), fullName: z.string().min(1).max(100).optional() });
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { phone, code, fullName } = parsed.data;
    const clean = phone.replace(/\s/g, "");
    const [otp] = await db.select().from(otpCodes).where(eq(otpCodes.phone, clean)).orderBy(desc(otpCodes.createdAt)).limit(1);
    if (!otp) return NextResponse.json({ error: "No OTP found" }, { status: 400 });
    if (otp.consumed) return NextResponse.json({ error: "OTP already used" }, { status: 400 });
    if (otp.expiresAt < new Date()) return NextResponse.json({ error: "OTP expired" }, { status: 400 });
    if (otp.attempts >= 5) {
      const locked = Date.now() - otp.createdAt.getTime() < 15 * 60 * 1000;
      if (locked) return NextResponse.json({ error: "Too many attempts, locked 15 min" }, { status: 429 });
    }
    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      await db.update(otpCodes).set({ attempts: sql`attempts + 1` }).where(eq(otpCodes.id, otp.id));
      try { await db.insert((await import("@/lib/db/schema")).auditLogs).values({ action: "otp:verify_fail", entity: "otp", newState: { phone: clean.slice(-4).padStart(clean.length,"*"), attempts: otp.attempts+1 } }); } catch {}
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }
    await db.update(otpCodes).set({ consumed: true }).where(eq(otpCodes.id, otp.id));
    try { await db.insert((await import("@/lib/db/schema")).auditLogs).values({ action: "otp:verify_success", entity: "otp", newState: { phone: clean.slice(-4).padStart(clean.length,"*") } }); } catch {}
    let [user] = await db.select().from(users).where(eq(users.phone, clean)).limit(1);
    if (!user) {
      const [created] = await db.insert(users).values({ phone: clean, fullName: (fullName?.trim() || clean).slice(0, 100), phoneVerified: true }).returning();
      user = created;
    } else if (!user.phoneVerified) {
      await db.update(users).set({ phoneVerified: true }).where(eq(users.id, user.id));
    }
    const token = await signJwt({ userId: user.id, phone: user.phone }, "24h");
    await db.insert(sessions).values({ userId: user.id, token, expiresAt: new Date(Date.now() + 24 * 3600000) });
    const res = NextResponse.json({ success: true, user: { id: user.id, phone: user.phone, fullName: user.fullName } });
    res.cookies.set("session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 });
    return res;
  } catch {
    return NextResponse.json({ error: "Failed to verify" }, { status: 500 });
  }
}
