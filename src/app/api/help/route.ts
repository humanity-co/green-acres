import { NextResponse } from "next/server";
import { dailyHelp, dailyHelpLinks, unitMembers, units } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("help:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
    const isPrivileged = roles.some((r:string)=>["GUARD","SECURITY_MANAGER","SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      if (isPrivileged) {
        const helps = await tx.select().from(dailyHelp).where(eq(dailyHelp.societyId, societyId)).orderBy(desc(dailyHelp.createdAt)).limit(50);
        if (helps.length === 0) return [];
        const helpIds = helps.map((h) => h.id);
        const links = await tx.select().from(dailyHelpLinks).where(and(eq(dailyHelpLinks.societyId, societyId), inArray(dailyHelpLinks.helpId, helpIds)));
        return helps.map((h) => ({ help: h, links: links.filter((l) => l.helpId === h.id) }));
      } else {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (unitIds.length===0) return [];
        const links = await tx.select().from(dailyHelpLinks).where(and(eq(dailyHelpLinks.societyId, societyId), inArray(dailyHelpLinks.unitId, unitIds)));
        const helpIds = [...new Set(links.map(l=>l.helpId))];
        if (helpIds.length===0) return [];
        const helps = await tx.select().from(dailyHelp).where(and(eq(dailyHelp.societyId, societyId), inArray(dailyHelp.id, helpIds)));
        return helps.map(h=>({ help: h, links: links.filter(l=>l.helpId===h.id), units: unitIds }));
      }
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(20),
  category: z.enum(["MAID","COOK","DRIVER","NANNY","GARDENER","OTHER"]),
  unitId: z.string().uuid().optional(),
  schedule: z.any().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("help:manage");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;

    const result = await withTenant(societyId, sess.userId, async (tx)=>{
      let unitId = parsed.data.unitId;
      if (!unitId) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        if (members.length===0) throw new Error("No unit membership");
        unitId = members[0].unitId;
      } else {
        const [unit] = await tx.select().from(units).where(and(eq(units.id, unitId), eq(units.societyId, societyId)));
        if (!unit) throw new Error("Unit not in society");
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, unitId)));
        const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
        const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
        if (members.length===0 && !isPrivileged) throw new Error("Not a member of unit");
      }
      const [help] = await tx.insert(dailyHelp).values({ name: parsed.data.name, phone: parsed.data.phone, category: parsed.data.category as any, societyId }).returning();
      const [link] = await tx.insert(dailyHelpLinks).values({ societyId, helpId: help.id, unitId, schedule: parsed.data.schedule || null }).returning();
      return { help, link };
    });

    await audit({ actorId: sess.userId, societyId, action:"create", entity:"daily_help", entityId: result.help.id, newState: result });
    return NextResponse.json(result, { status:201 });
  } catch (e:any) { return NextResponse.json({ error: e.message || "Failed" }, { status:500 }); }
}
