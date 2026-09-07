import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { otpCodes } from "@/lib/db/schema";
import { desc, gt, and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { getOtpProvider } from "@/lib/otp/provider";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone || !/^\+?\d{10,15}$/.test(phone.replace(/\s/g, ""))) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }
    const clean = phone.replace(/\s/g, "");
    const now = Date.now();

    if (process.env.NODE_ENV === "production" && (process.env.OTP_PROVIDER === "mock" || process.env.MOCK_OTP_ENABLED === "true")) {
      return NextResponse.json({ error: "Mock OTP not allowed in production" }, { status: 500 });
    }

    const recent = await db.select().from(otpCodes).where(and(eq(otpCodes.phone, clean), gt(otpCodes.createdAt, new Date(now - 3600000)))).orderBy(desc(otpCodes.createdAt));
    const last = recent[0];
    if (last && now - last.createdAt.getTime() < 60000) {
      return NextResponse.json({ error: "Resend cooldown 60s" }, { status: 429 });
    }
    if (recent.length >= 3) {
      return NextResponse.json({ error: "Rate limit 3/hr" }, { status: 429 });
    }

    const locked = recent.filter(r => r.attempts >= 5 && now - r.createdAt.getTime() < 15 * 60 * 1000);
    if (locked.length > 0) {
      return NextResponse.json({ error: "Too many attempts, locked 15 min" }, { status: 429 });
    }

    const isMock = process.env.OTP_PROVIDER === "mock" && process.env.MOCK_OTP_ENABLED === "true" && process.env.NODE_ENV !== "production";
    const code = isMock ? "123456" : randomInt(100000, 1000000).toString();
    const hash = await bcrypt.hash(code, 10);
    await db.insert(otpCodes).values({ phone: clean, codeHash: hash, expiresAt: new Date(now + 5 * 60 * 1000) });
    const provider = getOtpProvider();
    await provider.request(clean, code);
    try { await db.insert((await import("@/lib/db/schema")).auditLogs).values({ action: "otp:request", entity: "otp", entityId: null, newState: { phone: clean.slice(-4).padStart(clean.length,"*"), success: true } }); } catch {}
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
