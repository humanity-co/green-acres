import { NextResponse } from "next/server";
import { visitorEntries } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/lib/db/withTenant";
import { z } from "zod";
import { audit } from "@/lib/audit";

const schema = z.object({
  entryId: z.string().uuid(),
  idempotencyKey: z.string().uuid().optional(),
  isOffline: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("visitor:entry");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    if (parsed.data.isOffline === true) {
      return NextResponse.json({ error: "Offline check-out requires an enrolled guard device and signed authorization", code: "OFFLINE_AUTHORIZATION_REQUIRED" }, { status: 403 });
    }
    const { societyId, sess } = auth as any;

    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [entry] = await tx
        .select()
        .from(visitorEntries)
        .where(and(eq(visitorEntries.id, parsed.data.entryId), eq(visitorEntries.societyId, societyId)));
      if (!entry) throw new Error("Entry not found");

      // Idempotent resolution for offline sync or repeated check-out
      if (entry.checkOut) {
        if (parsed.data.idempotencyKey || parsed.data.isOffline) {
          return entry;
        }
        throw new Error("Already checked out");
      }

      const [upd] = await tx
        .update(visitorEntries)
        .set({ checkOut: new Date() })
        .where(and(eq(visitorEntries.id, parsed.data.entryId), eq(visitorEntries.societyId, societyId)))
        .returning();
      return upd;
    });

    await audit({
      actorId: sess.userId,
      societyId,
      action: "guard:check_out",
      entity: "visitor_entry",
      entityId: updated.id,
      newState: {
        ...updated,
        isOffline: parsed.data.isOffline ?? false,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = e.message || "Failed";
    if (msg.includes("not found")) return NextResponse.json({ error: msg, code: "NOT_FOUND" }, { status: 404 });
    if (msg.includes("Already checked out")) return NextResponse.json({ error: msg, code: "ALREADY_OUT" }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
