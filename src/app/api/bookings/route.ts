import { NextResponse } from "next/server";
import { bookings, amenities, amenitySlots, units, unitMembers, notifications, bills, billItems } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and, desc, inArray, ne, count } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuthAndSociety("booking:read");
  if ("error" in auth) return auth.error;
  try {
    const { societyId, sess } = auth as any;
    const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
    const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
    const items = await withTenant(societyId, sess.userId, async (tx)=>{
      let rows;
      if (isPrivileged) {
        rows = await tx.select().from(bookings).where(eq(bookings.societyId, societyId)).orderBy(desc(bookings.createdAt)).limit(50);
      } else {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        const unitIds = members.map(m=>m.unitId);
        if (unitIds.length===0) return [];
        rows = await tx.select().from(bookings).where(and(eq(bookings.societyId, societyId), inArray(bookings.unitId, unitIds))).orderBy(desc(bookings.createdAt)).limit(50);
      }
      if (rows.length === 0) return [];

      const amenityIds = Array.from(new Set(rows.map((b) => b.amenityId)));
      const slotIds = Array.from(new Set(rows.map((b) => b.slotId).filter(Boolean))) as string[];
      const unitIds = Array.from(new Set(rows.map((b) => b.unitId)));

      const [amenityList, slotList, unitList] = await Promise.all([
        tx.select().from(amenities).where(inArray(amenities.id, amenityIds)),
        slotIds.length > 0
          ? tx.select().from(amenitySlots).where(inArray(amenitySlots.id, slotIds))
          : Promise.resolve([]),
        tx.select().from(units).where(inArray(units.id, unitIds)),
      ]);

      const amenityMap = new Map(amenityList.map((a) => [a.id, a]));
      const slotMap = new Map(slotList.map((s) => [s.id, s]));
      const unitMap = new Map(unitList.map((u) => [u.id, u]));

      return rows.map((b) => ({
        booking: b,
        amenity: amenityMap.get(b.amenityId) || null,
        slot: b.slotId ? slotMap.get(b.slotId) || null : null,
        unit: unitMap.get(b.unitId) || null,
      }));
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json({ error:"Failed" }, { status:500 }); }
}

const createSchema = z.object({
  amenityId: z.string().uuid(),
  slotId: z.string().uuid().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unitId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("booking:create");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;

    const result = await withTenant(societyId, sess.userId, async (tx)=>{
      const [amenity] = await tx.select().from(amenities).where(and(eq(amenities.id, parsed.data.amenityId), eq(amenities.societyId, societyId)));
      if (!amenity) throw new Error("Amenity not found");
      if (!amenity.isActive) throw new Error("Amenity inactive");

      let unitId = parsed.data.unitId;
      if (!unitId) {
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.societyId, societyId)));
        if (members.length===0) throw new Error("No unit membership");
        unitId = members[0].unitId;
      }
      const [unit] = await tx.select().from(units).where(and(eq(units.id, unitId), eq(units.societyId, societyId)));
      if (!unit) throw new Error("Unit not in society");
      const memberCheck = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, unitId)));
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
      if (memberCheck.length===0 && !isPrivileged) throw new Error("Not a member of unit");

      let slotId = parsed.data.slotId || null;
      let slot: any = null;
      if (slotId) {
        const [s] = await tx.select().from(amenitySlots).where(and(eq(amenitySlots.id, slotId), eq(amenitySlots.societyId, societyId), eq(amenitySlots.amenityId, amenity.id)));
        if (!s) throw new Error("Slot not in amenity");
        slot = s;
      }

      const bookingDate = parsed.data.bookingDate;
      const today = new Date().toISOString().slice(0,10);
      if (bookingDate < today) throw new Error("Cannot book past date");

      // Validate slot start time if booking for today
      if (bookingDate === today && slot) {
        const nowHHMM = new Date().toTimeString().slice(0, 5);
        if (slot.startTime < nowHHMM) {
          throw Object.assign(new Error("Cannot book a slot that has already started or passed"), { code: "PAST_SLOT" });
        }
      }

      // Concurrency control: Lock amenity row and slot row (if specified) to prevent race conditions
      await tx
        .select()
        .from(amenities)
        .where(and(eq(amenities.id, amenity.id), eq(amenities.societyId, societyId)))
        .for("update");

      if (slotId) {
        await tx
          .select()
          .from(amenitySlots)
          .where(and(eq(amenitySlots.id, slotId), eq(amenitySlots.societyId, societyId)))
          .for("update");
      }

      // Check if this user already has an active (non-cancelled) booking for this slot/day
      const userConditions = [
        eq(bookings.societyId, societyId),
        eq(bookings.userId, sess.userId),
        eq(bookings.amenityId, amenity.id),
        eq(bookings.bookingDate, bookingDate),
        ne(bookings.status, "CANCELLED"),
      ];
      if (slotId) userConditions.push(eq(bookings.slotId, slotId) as any);
      const existingUserBookings = await tx.select().from(bookings).where(and(...userConditions as any));
      if (existingUserBookings.length > 0) {
        throw Object.assign(
          new Error("You already have an active booking for this slot on this date"),
          { code: "ALREADY_BOOKED" }
        );
      }

      // Capacity-aware check: count active bookings vs amenity.capacity
      const whereConditions = [
        eq(bookings.amenityId, amenity.id),
        eq(bookings.bookingDate, bookingDate),
        ne(bookings.status, "CANCELLED"),
      ];
      if (slotId) whereConditions.push(eq(bookings.slotId, slotId) as any);

      const [{ activeCount }] = await tx
        .select({ activeCount: count() })
        .from(bookings)
        .where(and(...whereConditions as any));

      if (Number(activeCount) >= amenity.capacity) {
        throw Object.assign(
          new Error(`Slot fully booked (capacity: ${amenity.capacity})`),
          { code: "CAPACITY_FULL" }
        );
      }

      // Determine initial status: paid amenities require payment first
      const hasFee = Number(amenity.fee) > 0;
      const initialStatus = hasFee ? "PENDING_PAYMENT" : "CONFIRMED";

      // For paid amenities: auto-create a bill with line items linked to booking
      let bill = null;
      if (hasFee) {
        const nextDay = new Date(new Date(bookingDate).getTime() + 86400000).toISOString().slice(0, 10);
        const [b] = await tx.insert(bills).values({
          societyId,
          unitId,
          title: `${amenity.name} Slot Booking (${bookingDate})`,
          periodStart: bookingDate,
          periodEnd: bookingDate,
          dueDate: nextDay,
          subtotal: amenity.fee,
          tax: "0.00",
          total: amenity.fee,
          status: "ISSUED",
        }).returning();
        bill = b;

        // Auto-generate invoice line item
        await tx.insert(billItems).values({
          billId: b.id,
          label: `${amenity.name} Booking — ${slot ? `${slot.startTime}–${slot.endTime}` : "Full Day"} (${bookingDate})`,
          amount: amenity.fee,
        });
      }

      const [created] = await tx.insert(bookings).values({
        societyId, amenityId: amenity.id, slotId, bookingDate, unitId, userId: sess.userId,
        status: initialStatus,
        billId: bill ? bill.id : null,
      }).returning();

      if (hasFee) {
        // Notify resident to complete payment
        await tx.insert(notifications).values({
          societyId, userId: sess.userId,
          title: `Payment required: ${amenity.name}`,
          body: `Your slot for ${amenity.name} on ${bookingDate} is reserved. Complete payment of ₹${amenity.fee} to confirm.`,
          channel: "IN_APP", relatedEntity: "booking", relatedId: created.id,
        });
      } else {
        // Free amenity — notify confirmed immediately
        await tx.insert(notifications).values({
          societyId, userId: sess.userId,
          title: `Booking confirmed: ${amenity.name}`,
          body: `Your booking for ${amenity.name} on ${bookingDate} is confirmed.`,
          channel: "IN_APP", relatedEntity: "booking", relatedId: created.id,
        });
      }

      return { booking: created, id: created.id, bill, amenity, slot, requiresPayment: hasFee };
    });

    await audit({ actorId: sess.userId, societyId, action:"create", entity:"booking", entityId: result.booking.id, newState: result });
    return NextResponse.json(result, { status:201 });
  } catch (e:any) {
    const msg = `${e.message || ""} ${e.cause?.message || ""} ${JSON.stringify(e.cause || {})}`;
    if (e.code === "CAPACITY_FULL") return NextResponse.json({ error: e.message }, { status: 409 });
    if (e.code === "ALREADY_BOOKED" || msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505") || e.code==="23505" || e.cause?.code==="23505") {
      return NextResponse.json({ error: e.message || "You already have a booking for this slot on this date" }, { status: 409 });
    }
    if (e.code === "PAST_SLOT") return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message==="Cannot book past date") return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message==="Amenity not found" || e.message==="Slot not in amenity" || e.message==="Unit not in society") return NextResponse.json({ error:e.message }, { status:404 });
    if (e.message==="Not a member of unit" || e.message==="No unit membership") return NextResponse.json({ error:e.message }, { status:403 });
    if (e.message==="Amenity inactive") return NextResponse.json({ error:e.message }, { status:409 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}
