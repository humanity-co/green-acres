import { NextResponse } from "next/server";
import { vehicleEntries, vehicles, units, gates, users } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

const checkInSchema = z.object({
  numberPlate: z.string().min(2).max(20),
  unitId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  gateId: z.string().uuid().optional(),
  isVisitor: z.boolean().optional().default(false),
  notes: z.string().max(300).optional(),
});

function normalizePlate(s: string) {
  return s.replace(/\s+/g, "").replace(/-+/g, "").toUpperCase();
}

export async function GET() {
  const auth = await requireAuthAndSociety("vehicle:entry");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const items = await withTenant(societyId, sess.userId, async (tx) => {
      const rows = await tx
        .select()
        .from(vehicleEntries)
        .where(and(eq(vehicleEntries.societyId, societyId), isNull(vehicleEntries.checkOut)))
        .orderBy(desc(vehicleEntries.checkIn))
        .limit(50);

      return Promise.all(
        rows.map(async (entry) => {
          const [unit] = entry.unitId
            ? await tx.select().from(units).where(eq(units.id, entry.unitId))
            : [null];
          const [vehicle] = entry.vehicleId
            ? await tx.select().from(vehicles).where(eq(vehicles.id, entry.vehicleId))
            : [null];
          return { entry, unit, vehicle };
        })
      );
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("vehicle:entry");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;
    const normalizedPlate = normalizePlate(parsed.data.numberPlate);

    const result = await withTenant(societyId, sess.userId, async (tx) => {
      // Check if already checked in
      const existing = await tx
        .select()
        .from(vehicleEntries)
        .where(
          and(
            eq(vehicleEntries.societyId, societyId),
            eq(vehicleEntries.numberPlate, normalizedPlate),
            isNull(vehicleEntries.checkOut)
          )
        );

      if (existing.length > 0) {
        throw new Error("Vehicle already checked in inside society");
      }

      // Find registered vehicle if not provided
      let vehicleId = parsed.data.vehicleId || null;
      let unitId = parsed.data.unitId || null;

      if (!vehicleId) {
        const [foundVeh] = await tx
          .select()
          .from(vehicles)
          .where(and(eq(vehicles.societyId, societyId), eq(vehicles.numberPlate, normalizedPlate)));
        if (foundVeh) {
          vehicleId = foundVeh.id;
          if (!unitId) unitId = foundVeh.unitId;
        }
      }

      const [entry] = await tx
        .insert(vehicleEntries)
        .values({
          societyId,
          vehicleId,
          unitId,
          gateId: parsed.data.gateId || null,
          guardId: sess.userId,
          numberPlate: normalizedPlate,
          isVisitor: parsed.data.isVisitor ?? (vehicleId ? false : true),
          notes: parsed.data.notes || null,
          checkIn: new Date(),
        })
        .returning();

      return entry;
    });

    await audit({
      actorId: sess.userId,
      societyId,
      action: "vehicle:check_in",
      entity: "vehicle_entry",
      entityId: result.id,
      newState: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("already checked in")) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

const checkOutSchema = z.object({
  entryId: z.string().uuid(),
});

export async function PATCH(req: Request) {
  const auth = await requireAuthAndSociety("vehicle:entry");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = checkOutSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { societyId, sess } = auth as any;

    const updated = await withTenant(societyId, sess.userId, async (tx) => {
      const [entry] = await tx
        .select()
        .from(vehicleEntries)
        .where(and(eq(vehicleEntries.id, parsed.data.entryId), eq(vehicleEntries.societyId, societyId)));

      if (!entry) throw new Error("Entry not found");
      if (entry.checkOut) throw new Error("Vehicle already checked out");

      const [upd] = await tx
        .update(vehicleEntries)
        .set({ checkOut: new Date() })
        .where(and(eq(vehicleEntries.id, parsed.data.entryId), eq(vehicleEntries.societyId, societyId)))
        .returning();

      return upd;
    });

    await audit({
      actorId: sess.userId,
      societyId,
      action: "vehicle:check_out",
      entity: "vehicle_entry",
      entityId: updated.id,
      newState: updated,
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message?.includes("not found")) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e.message?.includes("already checked out")) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
