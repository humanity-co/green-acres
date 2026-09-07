import { NextResponse } from "next/server";
import { polls, pollOptions, pollVotes } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("poll:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx) => {
      const [p] = await tx.select().from(polls).where(and(eq(polls.id, id), eq(polls.societyId, societyId)));
      if (!p) throw new Error("Not found");
      const opts = await tx.select().from(pollOptions).where(eq(pollOptions.pollId, p.id));
      const votes = await tx.select().from(pollVotes).where(eq(pollVotes.pollId, p.id));
      const counts: Record<string, number> = {};
      for (const o of opts) counts[o.id] = 0;
      for (const v of votes) if (counts[v.optionId] !== undefined) counts[v.optionId]++;
      const userVote = votes.find((v) => v.userId === sess.userId);
      return { poll: p, options: opts.map((o) => ({ ...o, voteCount: counts[o.id] || 0 })), totalVotes: votes.length, userVoteOptionId: userVote?.optionId || null, isClosed: p.endsAt ? new Date(p.endsAt) < new Date() : false };
    });
    return NextResponse.json(data);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("poll:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { question, endsAt } = body;
    if (question && (typeof question !== "string" || question.length < 5 || question.length > 500)) return NextResponse.json({ error: "Invalid question" }, { status: 400 });
    const { societyId, sess } = auth as any;
    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(polls).where(and(eq(polls.id, id), eq(polls.societyId, societyId)));
      if (!existing) throw new Error("Not found");
      const patch: any = {};
      if (question) patch.question = question;
      if (endsAt !== undefined) patch.endsAt = endsAt ? new Date(endsAt) : null;
      if (Object.keys(patch).length === 0) return existing;
      const [upd] = await tx.update(polls).set(patch).where(and(eq(polls.id, id), eq(polls.societyId, societyId))).returning();
      return upd;
    });
    await audit({ actorId: sess.userId, societyId, action: "update", entity: "poll", entityId: id, newState: updated });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("poll:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    await withTenant(societyId, sess.userId, async (tx) => {
      const [existing] = await tx.select().from(polls).where(and(eq(polls.id, id), eq(polls.societyId, societyId)));
      if (!existing) throw new Error("Not found");
      const votes = await tx.select().from(pollVotes).where(eq(pollVotes.pollId, id));
      if (votes.length > 0) throw new Error("Poll has votes");
      await tx.delete(polls).where(and(eq(polls.id, id), eq(polls.societyId, societyId)));
    });
    await audit({ actorId: sess.userId, societyId, action: "delete", entity: "poll", entityId: id });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.message === "Poll has votes") return NextResponse.json({ error: "Poll has votes" }, { status: 409 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
