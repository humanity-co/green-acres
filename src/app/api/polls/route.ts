import { NextResponse } from "next/server";
import { polls, pollOptions, pollVotes, notifications, userSocietyRoles } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
export async function GET() {
  const auth = await requireAuthAndSociety("poll:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) => {
      const ps = await tx.select().from(polls).where(eq(polls.societyId, societyId)).orderBy(desc(polls.createdAt)).limit(30);
      const enriched = await Promise.all(ps.map(async (p) => {
        const opts = await tx.select().from(pollOptions).where(eq(pollOptions.pollId, p.id));
        const votes = await tx.select().from(pollVotes).where(eq(pollVotes.pollId, p.id));
        const counts: Record<string, number> = {};
        for (const o of opts) counts[o.id] = 0;
        for (const v of votes) if (counts[v.optionId] !== undefined) counts[v.optionId]++;
        const userVote = votes.find((v) => v.userId === sess.userId);
        return { poll: p, options: opts.map((o) => ({ ...o, voteCount: counts[o.id] || 0 })), totalVotes: votes.length, userVoteOptionId: userVote?.optionId || null, isClosed: p.endsAt ? new Date(p.endsAt) < new Date() : false };
      }));
      return enriched;
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
const createSchema = z.object({ question: z.string().min(5).max(500), options: z.array(z.string().min(1).max(100)).min(2).max(6), endsAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()), isAnonymous: z.boolean().optional() });
export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("poll:manage");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    if (parsed.data.endsAt) {
      const d = new Date(parsed.data.endsAt);
      if (isNaN(d.getTime()) || d < new Date()) return NextResponse.json({ error: "endsAt must be future" }, { status: 400 });
    }
    const { societyId, sess } = auth as any;
    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [poll] = await tx.insert(polls).values({ societyId, question: parsed.data.question, createdBy: sess.userId, endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) as any : null, isAnonymous: parsed.data.isAnonymous || false }).returning();
      const opts = await Promise.all(parsed.data.options.map((label) => tx.insert(pollOptions).values({ pollId: poll.id, label }).returning().then((r) => r[0])));
      const members = await tx.select({ userId: userSocietyRoles.userId }).from(userSocietyRoles).where(eq(userSocietyRoles.societyId, societyId));
      const uniqueUserIds = Array.from(new Set(members.map((m) => m.userId)));
      const CHUNK_SIZE = 500;
      for (let i = 0; i < uniqueUserIds.length; i += CHUNK_SIZE) {
        const chunk = uniqueUserIds.slice(i, i + CHUNK_SIZE);
        await tx.insert(notifications).values(
          chunk.map((userId) => ({
            societyId,
            userId,
            title: `New poll: ${parsed.data.question.slice(0, 60)}`,
            body: `Vote now • ${parsed.data.options.length} options`,
            channel: "IN_APP" as const,
            relatedEntity: "poll",
            relatedId: poll.id,
          }))
        );
      }
      return { poll, options: opts };
    });
    await audit({ actorId: sess.userId, societyId, action: "create", entity: "poll", entityId: result.poll.id, newState: result });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}
