"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
export default function AdminBookings(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ fetch("/api/bookings").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>setItems(Array.isArray(d)?d:[])).catch(()=>setError("Failed to load bookings")).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if(error) return <AppShell><div className="max-w-6xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;
  const statuses = ["CONFIRMED","CANCELLED","COMPLETED","EXPIRED"];
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Bookings — Admin" description="Amenity bookings • society-scoped" />
        <Card><CardContent className="p-0 divide-y">
          {items.slice(0,20).map((b:any)=>(
            <div key={b.booking.id} className="p-3 flex justify-between">
              <div className="flex flex-col">
                <p className="text-sm font-medium">{b.amenity?.name || b.booking.amenityId.slice(0,8)}</p>
                <p className="text-xs text-muted-foreground">{b.booking.bookingDate} • {b.slot ? b.slot.startTime + "–" + b.slot.endTime : "No slot"}</p>
              </div>
              <div className="text-right">
                {StatusBadge({ status: b.booking.status })}
              </div>
            </div>
          ))}
          {items.length===0 && (
            <div className="py-10">
              <EmptyState icon={<Calendar className="h-5 w-5" />} title="No bookings" description="Bookings appear here." />
            </div>
          )}
        </CardContent></Card>
        <p className="text-xs text-muted-foreground">Filters: upcoming · today · past · cancelled. Amenity filtering available via API.</p>
      </div>
    </AppShell>
  );
}