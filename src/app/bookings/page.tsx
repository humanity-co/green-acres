"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { ListCard } from "@/components/shared/ListCard";
import { Calendar } from "lucide-react";

export default function BookingsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const counts = useMemo(() => {
    return {
      upcoming: items.filter(({ booking }: any) => 
        (booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT") && booking.bookingDate >= today
      ).length,
      pendingPayment: items.filter(({ booking }: any) => 
        booking.status === "PENDING_PAYMENT" && booking.bookingDate >= today
      ).length,
      today: items.filter(({ booking }: any) => 
        booking.bookingDate === today && (booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT")
      ).length,
      past: items.filter(({ booking }: any) => 
        booking.bookingDate < today && booking.status !== "CANCELLED"
      ).length,
      cancelled: items.filter(({ booking }: any) => 
        booking.status === "CANCELLED"
      ).length,
    };
  }, [items, today]);

  const filtered = useMemo(() => {
    return items.filter(({ booking }: any) => {
      if (tab === "upcoming") {
        return (booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT") && booking.bookingDate >= today;
      }
      if (tab === "pendingPayment") {
        return booking.status === "PENDING_PAYMENT" && booking.bookingDate >= today;
      }
      if (tab === "today") {
        return booking.bookingDate === today && (booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT");
      }
      if (tab === "past") {
        return booking.bookingDate < today && booking.status !== "CANCELLED";
      }
      if (tab === "cancelled") {
        return booking.status === "CANCELLED";
      }
      return true;
    });
  }, [items, tab, today]);

  if (loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="My Bookings" description="Amenity passes &amp; slot reservations • Tap to view details" />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full overflow-x-auto gap-1 h-10 p-1 justify-start">
            <TabsTrigger value="upcoming" className="text-xs whitespace-nowrap shrink-0">
              Upcoming {counts.upcoming > 0 && <Badge variant="secondary" className="ml-1 px-1">{counts.upcoming}</Badge>}
            </TabsTrigger>
            {counts.pendingPayment > 0 && (
              <TabsTrigger value="pendingPayment" className="text-xs whitespace-nowrap shrink-0 text-amber-600 dark:text-amber-400 font-semibold">
                Payment Pending <Badge variant="secondary" className="ml-1 px-1 bg-amber-500/20 text-amber-600">{counts.pendingPayment}</Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="today" className="text-xs whitespace-nowrap shrink-0">
              Today {counts.today > 0 && <Badge variant="secondary" className="ml-1 px-1">{counts.today}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="past" className="text-xs whitespace-nowrap shrink-0">Past</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs whitespace-nowrap shrink-0">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <EmptyState 
            icon={<Calendar className="h-5 w-5" />} 
            title={
              tab === "upcoming" ? "No upcoming bookings" :
              tab === "pendingPayment" ? "No pending payment bookings" :
              tab === "today" ? "No bookings today" : 
              tab === "cancelled" ? "No cancelled bookings" : "No bookings"
            } 
            description="Book swimming pool, gym, or clubhouse slots anytime." 
            actionLabel="Browse Amenities" 
            onAction={() => location.href = "/amenities"} 
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(({ booking, amenity, slot, unit }: any) => (
              <ListCard
                key={booking.id}
                href={`/bookings/${booking.id}`}
                title={amenity?.name || booking.amenityId.slice(0, 8)}
                subtitle={`${booking.bookingDate} • ${slot ? `${slot.startTime}–${slot.endTime}` : "Full Day"}`}
                meta={`Unit ${unit?.number || booking.unitId.slice(0, 8)} • ${new Date(booking.createdAt).toLocaleDateString()}`}
                status={booking.status}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
