import { NextResponse } from "next/server";
import { bookings, amenities, amenitySlots, units, bills, payments, notifications } from "@/lib/db/schema";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/lib/db/withTenant";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("booking:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    const data = await withTenant(societyId, sess.userId, async (tx)=>{
      const [b] = await tx.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.societyId, societyId)));
      if (!b) return null;
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
      if (!isPrivileged && b.userId !== sess.userId) {
        const { unitMembers } = await import("@/lib/db/schema");
        const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, b.unitId)));
        if (members.length===0) throw new Error("Forbidden");
      }
      const [amenity] = await tx.select().from(amenities).where(eq(amenities.id, b.amenityId));
      const [slot] = b.slotId ? await tx.select().from(amenitySlots).where(eq(amenitySlots.id, b.slotId)) : [null];
      const [unit] = await tx.select().from(units).where(eq(units.id, b.unitId));
      
      let bill = null;
      let payment = null;
      if (b.billId) {
        const [bl] = await tx.select().from(bills).where(and(eq(bills.id, b.billId), eq(bills.societyId, societyId)));
        bill = bl || null;
        if (bl) {
          const [pm] = await tx.select().from(payments).where(and(eq(payments.billId, bl.id), eq(payments.societyId, societyId))).orderBy(eq(payments.createdAt, payments.createdAt));
          payment = pm || null;
        }
      }

      // Calculate cancellation refund preview
      const slotStartTime = slot?.startTime || "00:00";
      const slotStartDateTime = new Date(`${b.bookingDate}T${slotStartTime}:00`);
      const now = new Date();
      const diffHours = (slotStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const isPastOrOngoing = diffHours < 0;
      const refundPercentage = diffHours >= 24 ? 100 : diffHours >= 6 ? 50 : 0;

      return {
        booking: b,
        amenity,
        slot,
        unit,
        bill,
        payment,
        cancellationEstimate: {
          diffHours: Math.round(diffHours * 10) / 10,
          isPastOrOngoing,
          refundPercentage,
          canCancel: (b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT") && (!isPastOrOngoing || isPrivileged),
        },
      };
    });
    if (!data) return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json(data);
  } catch (e:any) {
    if (e.message==="Forbidden") return NextResponse.json({ error:"Forbidden" }, { status:403 });
    return NextResponse.json({ error:"Failed" }, { status:500 });
  }
}

const patchSchema = z.object({ status: z.enum(["CONFIRMED","CANCELLED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("booking:read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid input" }, { status:400 });
    const { societyId, sess } = auth as any;

    const result = await withTenant(societyId, sess.userId, async (tx)=>{
      const [b] = await tx.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.societyId, societyId)));
      if (!b) throw new Error("Not found");
      if (b.status==="CANCELLED") throw new Error("Already cancelled");
      if (b.status==="COMPLETED") throw new Error("Cannot cancel completed");
      const roles = await import("@/lib/tenant").then(m=>m.getUserRoles(sess.userId, societyId));
      const isPrivileged = roles.some((r:string)=>["SOCIETY_ADMIN","FACILITY_MANAGER","SUPER_ADMIN"].includes(r));
      const isOwner = b.userId===sess.userId;
      if (!isOwner && !isPrivileged) throw new Error("Forbidden");
      if (parsed.data.status==="CONFIRMED" && !isPrivileged) {
        throw new Error("Forbidden: Only staff can manually confirm bookings without online payment");
      }
      if (parsed.data.status==="CANCELLED" && !isOwner && !isPrivileged) throw new Error("Forbidden");

      let refundPercentage = 0;
      let refundAmountPaise = 0;
      let refundResult: any = null;

      // If cancelling: handle slot timing validation & tiered refund policy
      if (parsed.data.status === "CANCELLED") {
        const [slot] = b.slotId
          ? await tx.select().from(amenitySlots).where(eq(amenitySlots.id, b.slotId))
          : [null];
        const slotStartTime = slot?.startTime || "00:00";
        const slotStartDateTime = new Date(`${b.bookingDate}T${slotStartTime}:00`);
        const now = new Date();
        const diffHours = (slotStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours < 0 && !isPrivileged) {
          throw Object.assign(new Error("Cannot cancel a past or ongoing booking"), { code: "PAST_BOOKING" });
        }

        // Tiered policy: >24h = 100%, 6-24h = 50%, <6h = 0%
        if (diffHours >= 24) {
          refundPercentage = 100;
        } else if (diffHours >= 6) {
          refundPercentage = 50;
        } else {
          refundPercentage = 0;
        }

        if (b.billId) {
          const [bill] = await tx.select().from(bills).where(and(eq(bills.id, b.billId), eq(bills.societyId, societyId)));
          if (bill) {
            if (bill.status !== "PAID") {
              await tx.update(bills).set({ status: "CANCELLED" }).where(eq(bills.id, bill.id));
            } else {
              const [p] = await tx.select().from(payments).where(and(eq(payments.billId, bill.id), eq(payments.status, "SUCCESS")));
              if (p) {
                if (refundPercentage > 0) {
                  const { getPaymentProvider, amountToPaise } = await import("@/lib/payments/provider");
                  const originalPaise = amountToPaise(p.amount);
                  refundAmountPaise = Math.round(originalPaise * (refundPercentage / 100));
                  try {
                    refundResult = await getPaymentProvider().refund({
                      paymentId: p.gatewayRef || p.id,
                      amountPaise: refundAmountPaise,
                      reason: `Booking cancelled (${refundPercentage}% refund per policy)`,
                    });
                  } catch (err) {
                    console.warn("[BOOKING REFUND WARN]", err);
                  }

                  await tx.update(payments).set({
                    status: "REFUNDED",
                    rawPayload: {
                      ...(p.rawPayload as any),
                      refundPercentage,
                      refundAmountPaise,
                      refundId: refundResult?.refundId,
                      refundedAt: new Date().toISOString(),
                    },
                  }).where(eq(payments.id, p.id));
                  await tx.update(bills).set({ status: "CANCELLED" }).where(eq(bills.id, bill.id));
                  await audit({
                    actorId: sess.userId,
                    societyId,
                    action: "payment:refund",
                    entity: "payment",
                    entityId: p.id,
                    newState: { status: "REFUNDED", bookingId: id, refundPercentage, refundAmountPaise }
                  });
                } else {
                  await audit({
                    actorId: sess.userId,
                    societyId,
                    action: "booking:cancel_no_refund",
                    entity: "booking",
                    entityId: id,
                    newState: { reason: "Late cancellation < 6 hours before slot", bookingId: id }
                  });
                }
              }
            }
          }
        }

        // Notification to resident
        await tx.insert(notifications).values({
          societyId,
          userId: b.userId,
          title: "Booking cancelled",
          body: refundPercentage > 0
            ? `Your booking for ${b.bookingDate} has been cancelled. Refund of ${refundPercentage}% (₹${(refundAmountPaise / 100).toFixed(2)}) has been initiated.`
            : `Your booking for ${b.bookingDate} has been cancelled. As per society policy (<6h notice), no refund is applicable.`,
          channel: "IN_APP",
          relatedEntity: "booking",
          relatedId: id,
        });
      }

      const [upd] = await tx.update(bookings).set({ status: parsed.data.status }).where(and(eq(bookings.id, id), eq(bookings.societyId, societyId))).returning();
      return { booking: upd, refundPercentage, refundAmountPaise, refundResult };
    });

    await audit({
      actorId: sess.userId,
      societyId,
      action: "update",
      entity: "booking",
      entityId: id,
      newState: result.booking,
      prevState: { status: "CONFIRMED" },
    });
    return NextResponse.json(result.booking);
  } catch (e:any) {
    if (e.message?.startsWith("Forbidden")) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e.code === "PAST_BOOKING" || e.message === "Cannot cancel a past or ongoing booking") return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    if (e.message==="Already cancelled") return NextResponse.json({ error:e.message }, { status:409 });
    return NextResponse.json({ error: e.message || "Failed" }, { status:500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndSociety("booking:manage");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { societyId, sess } = auth as any;
    await withTenant(societyId, sess.userId, async (tx)=>{
      const [b] = await tx.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.societyId, societyId)));
      if (!b) throw new Error("Not found");
      if (b.billId) {
        const [bill] = await tx.select().from(bills).where(and(eq(bills.id, b.billId), eq(bills.societyId, societyId)));
        if (bill && bill.status !== "PAID") {
          await tx.update(bills).set({ status: "CANCELLED" }).where(eq(bills.id, bill.id));
        }
      }
      await tx.delete(bookings).where(and(eq(bookings.id, id), eq(bookings.societyId, societyId)));
    });
    await audit({ actorId: sess.userId, societyId, action:"delete", entity:"booking", entityId: id });
    return NextResponse.json({ success:true });
  } catch (e:any) {
    if (e.message==="Not found") return NextResponse.json({ error:"Not found" }, { status:404 });
    return NextResponse.json({ error:"Failed" }, { status:500 });
  }
}
