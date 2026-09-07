import { NextResponse } from "next/server";
import { polls, pollOptions, pollVotes } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("poll:vote");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const optionId = body.optionId;
    if (!optionId || typeof optionId !== "string") return NextResponse.json({ error: "Invalid optionId" }, { status: 400 });
    const { societyId, sess } = auth as any;
    const result = await withTenant(societyId, sess.userId, async (tx) => {
      const [poll] = await tx.select().from(polls).where(and(eq(polls.id, id), eq(polls.societyId, societyId)));
      if (!poll) throw new Error("Not found");
      if (poll.endsAt && new Date(poll.endsAt) < new Date()) throw new Error("Poll closed");
      const [opt] = await tx.select().from(pollOptions).where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, id)));
      if (!opt) throw new Error("Invalid option");
      const existing = await tx.select().from(pollVotes).where(and(eq(pollVotes.pollId, id), eq(pollVotes.userId, sess.userId)));
      if (existing.length > 0) throw new Error("Already voted");
      const [vote] = await tx.insert(pollVotes).values({ societyId, pollId: id, optionId, userId: sess.userId }).returning();
      return vote;
    });
    await audit({ actorId: sess.userId, societyId, action: "vote", entity: "poll", entityId: id, newState: { optionId } });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.message === "Invalid option") return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    if (e.message === "Already voted") return NextResponse.json({ error: "Already voted" }, { status: 409 });
    if (e.message === "Poll closed") return NextResponse.json({ error: "Poll closed" }, { status: 409 });
    if (e.message?.includes("duplicate") || e.message?.includes("unique")) return NextResponse.json({ error: "Already voted" }, { status: 409 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
