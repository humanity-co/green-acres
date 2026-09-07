import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { societies, userSocietyRoles } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("society:read");
  if ("error" in auth) return auth.error;
  try {
    const { sess } = auth as any;
    const memberships = await db.select().from(userSocietyRoles).where(eq(userSocietyRoles.userId, sess.userId));
    const ids = Array.from(new Set(memberships.map(m => m.societyId)));
    if (ids.length === 0) return NextResponse.json([]);
    const items = await db.select().from(societies).where(inArray(societies.id, ids));
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}

const createSchema = z.object({ name: z.string().min(1).max(100), code: z.string().min(1).max(20), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), pincode: z.string().optional() });

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("society:manage");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { sess } = auth as any;
    const [item] = await db.insert(societies).values({ ...parsed.data, createdBy: sess.userId }).returning();
    await db.insert(userSocietyRoles).values({ userId: sess.userId, societyId: item.id, role: "SOCIETY_ADMIN" });
    await audit({ actorId: sess.userId, societyId: item.id, action: "create", entity: "society", entityId: item.id, newState: item });
    return NextResponse.json(item, { status: 201 });
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
