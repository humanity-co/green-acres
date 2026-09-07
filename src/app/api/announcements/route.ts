import { NextResponse, after } from "next/server";
import { announcements, notifications, userSocietyRoles } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("announcement:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) =>
      tx
        .select()
        .from(announcements)
        .where(eq(announcements.societyId, societyId))
        .orderBy(desc(announcements.createdAt))
        .limit(20)
    );
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL"),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("announcement:manage");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;

    const item = await withTenant(societyId, sess.userId, async (tx) => {
      const [created] = await tx
        .insert(announcements)
        .values({
          title: parsed.data.title,
          body: parsed.data.body,
          priority: parsed.data.priority,
          societyId,
          authorId: sess.userId,
        })
        .returning();
      return created;
    });

    await audit({
      actorId: sess.userId,
      societyId,
      action: "create",
      entity: "announcement",
      entityId: item.id,
      newState: item,
    });

    // P1 FIX: Asynchronous chunked notification fan-out via Next.js after() with RLS tenant context.
    after(async () => {
      try {
        await withTenant(societyId, sess.userId, async (tx) => {
          const members = await tx
            .select({ userId: userSocietyRoles.userId })
            .from(userSocietyRoles)
            .where(eq(userSocietyRoles.societyId, societyId));

          const uniqueUserIds = Array.from(new Set(members.map((m) => m.userId)));
          const CHUNK_SIZE = 500;
          for (let i = 0; i < uniqueUserIds.length; i += CHUNK_SIZE) {
            const chunk = uniqueUserIds.slice(i, i + CHUNK_SIZE);
            await tx.insert(notifications).values(
              chunk.map((userId) => ({
                societyId,
                userId,
                title: `📢 Announcement: ${parsed.data.title}`,
                body: parsed.data.body.slice(0, 120),
                channel: "IN_APP" as const,
                relatedEntity: "announcement",
                relatedId: item.id,
              }))
            );
          }
        });
      } catch (err) {
        console.error("[ANNOUNCEMENT FAN-OUT ERROR]", err);
      }
    });

    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
