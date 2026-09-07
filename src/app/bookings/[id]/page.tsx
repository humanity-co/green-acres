"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, Users, AlertCircle, CreditCard, ShieldCheck, ArrowRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function BookingDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  function loadBooking() {
    return fetch(`/api/bookings/${params.id}`)
      .then(r => { if(!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBooking();
  }, [params.id]);

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Cancellation failed");
      toast.success("Booking cancelled");
      await loadBooking();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (!data) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center">Not found</CardContent></Card></div></AppShell>;

  const { booking, amenity, slot, unit, bill, payment, cancellationEstimate } = data;
  const isPendingPayment = booking.status === "PENDING_PAYMENT";
  const isConfirmed = booking.status === "CONFIRMED";
  const isCancelled = booking.status === "CANCELLED";
  const canCancel = cancellationEstimate?.canCancel ?? (
    (isConfirmed || isPendingPayment) && booking.bookingDate >= new Date().toISOString().slice(0, 10)
  );
  const refundPercent = cancellationEstimate?.refundPercentage ?? 100;
  const feeNumber = Number(amenity?.fee || 0);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/bookings")}>← My Bookings</Button>

        {/* Hero Card */}
        <Card className={isPendingPayment ? "border-amber-500/50 bg-amber-500/5" : ""}>
          <CardContent className="pt-6 text-center space-y-2">
            <h1 className="text-xl font-semibold">{amenity?.name || "Amenity"}</h1>
            <p className="text-sm text-muted-foreground">{booking.bookingDate} • {slot ? `${slot.startTime}–${slot.endTime}` : "Full Day"}</p>
            <div className="flex justify-center pt-1">
              <StatusBadge status={booking.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Pass #{booking.id.slice(0, 8).toUpperCase()} • Unit {unit?.number || booking.unitId.slice(0, 8)}
            </p>
          </CardContent>
        </Card>

        {/* Pending Payment Action Banner */}
        {isPendingPayment && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                    Payment Required to Confirm Slot
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Your slot is temporarily reserved. Complete the fee of ₹{amenity?.fee} to activate your gate entry pass.
                  </p>
                </div>
              </div>
              {booking.billId ? (
                <Button 
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  onClick={() => router.push(`/bills/${booking.billId}`)}
                >
                  <CreditCard className="h-4 w-4 mr-2" /> Pay ₹{amenity?.fee} Now
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Booking Details Card */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Booking Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Date</span><span className="font-medium">{booking.bookingDate}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Time Slot</span><span className="font-medium">{slot ? `${slot.startTime}–${slot.endTime}` : "Full Day"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Amenity</span><span className="font-medium">{amenity?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Capacity</span><span>{amenity?.capacity} Persons</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Booking Fee</span><span className="font-medium">{feeNumber > 0 ? `₹${amenity.fee}` : "Free"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span className="font-medium">{unit?.number}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={booking.status} /></div>
            {payment && (
              <div className="flex justify-between"><span className="text-muted-foreground">Payment Status</span><Badge variant={payment.status === "REFUNDED" ? "secondary" : "default"}>{payment.status}</Badge></div>
            )}
          </CardContent>
        </Card>

        {/* Cancellation & Refund Policy Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Society Cancellation & Refund Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1.5">
            <div className="flex justify-between py-0.5 border-b border-border/40">
              <span>Notice &gt; 24 hours prior to slot:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">100% Refund</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-border/40">
              <span>Notice 6–24 hours prior to slot:</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">50% Refund</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Notice &lt; 6 hours prior to slot:</span>
              <span className="font-medium text-red-600 dark:text-red-400">Non-Refundable</span>
            </div>
          </CardContent>
        </Card>

        {/* Cancellation Action */}
        {canCancel ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={cancelling}>
                {cancelling ? "Processing Cancellation..." : "Cancel Booking"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Amenity Booking?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2 text-sm">
                  <p>Your slot will be released for other society residents.</p>
                  {feeNumber > 0 && isConfirmed && (
                    <div className="rounded-lg bg-muted p-3 space-y-1 text-xs text-foreground">
                      <p className="font-semibold">Refund Estimate:</p>
                      <p>Notice window: <strong>{cancellationEstimate?.diffHours ?? "N/A"} hours before slot</strong></p>
                      <p>Refund applicable: <strong>{refundPercent}% (₹{((feeNumber * refundPercent) / 100).toFixed(2)})</strong></p>
                    </div>
                  )}
                  {isPendingPayment && (
                    <p className="text-xs text-muted-foreground">
                      Since payment has not been made yet, the linked invoice will simply be voided.
                    </p>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                <AlertDialogAction onClick={cancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Cancel Booking
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            {isCancelled ? "Booking Cancelled" : "Cancellation Window Expired"}
          </Button>
        )}

        <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => router.push("/amenities")}>
          Browse All Amenities <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </AppShell>
  );
}
