import { NextResponse } from "next/server";
import { events } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
export async function GET() {
  const auth = await requireAuthAndSociety("event:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) => tx.select().from(events).where(eq(events.societyId, societyId)).orderBy(desc(events.startsAt)).limit(30));
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
const schema = z.object({ title: z.string().min(3).max(200), description: z.string().max(2000).optional(), startsAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)), endsAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/).optional()), location: z.string().max(200).optional() });
export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("event:manage");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    if (parsed.data.endsAt && new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
      return NextResponse.json({ error: "endsAt must be after startsAt" }, { status: 400 });
    }
    const { societyId, sess } = auth as any;
    const item = await withTenant(societyId, sess.userId, async (tx) => {
      const [created] = await tx.insert(events).values({ societyId, title: parsed.data.title, description: parsed.data.description || null, startsAt: new Date(parsed.data.startsAt) as any, endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) as any : null, location: parsed.data.location || null, createdBy: sess.userId }).returning();
      return created;
    });
    await audit({ actorId: sess.userId, societyId, action: "create", entity: "event", entityId: item.id, newState: item });
    return NextResponse.json(item, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}
