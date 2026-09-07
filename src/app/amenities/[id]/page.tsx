"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Clock, Users, MapPin } from "lucide-react";

export default function AmenityDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0,10));
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [booking, setBooking] = useState(false);
  const [myBookings, setMyBookings] = useState<any[]>([]);

  useEffect(()=>{
    fetch(`/api/amenities/${params.id}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(setData).catch(()=>{}).finally(()=>setLoading(false));
    fetch("/api/units").then(r=>r.json()).then(d=>{ if(Array.isArray(d)&&d.length) setSelectedUnit(d[0].id); setUnits(Array.isArray(d)? d: []); }).catch(()=>{});
    fetch("/api/bookings").then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setMyBookings(d); }).catch(()=>{});
  }, [params.id]);

  async function book(){
    if (!selectedSlot) return toast.error("Select a slot");
    setBooking(true);
    try {
      const res = await fetch("/api/bookings", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ amenityId: params.id, slotId: selectedSlot, bookingDate, unitId: selectedUnit || undefined }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      if (d.requiresPayment) {
        toast.success("Slot reserved! Please complete payment to confirm.");
      } else {
        toast.success("Booking confirmed!");
      }
      const bookingId = d.booking?.id || d.id;
      router.push(`/bookings/${bookingId}`);
    } catch (e:any){ toast.error(e.message || "Slot no longer available"); }
    finally { setBooking(false); }
  }

  if (loading) return <AppShell><div className="max-w-3xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (!data) return <AppShell><div className="max-w-3xl mx-auto"><Card><CardContent className="py-10 text-center">Not found</CardContent></Card></div></AppShell>;

  const { amenity, slots } = data;
  const dayOfWeek = new Date(bookingDate).getDay();
  const todaysSlots = slots.filter((s:any)=> s.dayOfWeek===dayOfWeek);
  const isToday = bookingDate===new Date().toISOString().slice(0,10);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/amenities")}>← Amenities</Button>

        <Card>
          <CardContent className="pt-6">
            <h1 className="text-lg font-semibold">{amenity.name}</h1>
            <p className="text-sm text-muted-foreground">{amenity.type} • Capacity {amenity.capacity} • {amenity.fee==="0" || amenity.fee==="0.00" ? "Free" : `₹${amenity.fee}`}</p>
            {amenity.rules && <p className="text-sm mt-2">{amenity.rules}</p>}
            <div className="flex gap-2 mt-3">
              <Badge variant={amenity.isActive ? "default" : "secondary"}>{amenity.isActive ? "Available" : "Inactive"}</Badge>
              <Badge variant="outline" className="flex items-center gap-1"><Users className="h-3 w-3" />{amenity.capacity} capacity</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Book a slot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={bookingDate} onChange={e=>setBookingDate(e.target.value)} min={new Date().toISOString().slice(0,10)} />
                <p className="text-xs text-muted-foreground">Today: {new Date().toLocaleDateString()} • Selected {new Date(bookingDate).toLocaleDateString()}</p>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.slice(0,10).map((u:any)=><SelectItem key={u.id} value={u.id}>{u.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {todaysSlots.length===0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Clock className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium mt-2">No slots available for this date</p>
                <p className="text-xs text-muted-foreground">Day {dayOfWeek} has no scheduled slots</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Available slots ({todaysSlots.length})</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {todaysSlots.map((s:any)=>{
                    const isPast = isToday && s.endTime < new Date().toTimeString().slice(0,5);
                    const isBookedByMe = myBookings.some((b:any)=> b.booking.slotId===s.id && b.booking.bookingDate===bookingDate && b.booking.status!=="CANCELLED");
                    return (
                      <button
                        key={s.id}
                        onClick={()=> !isPast && !isBookedByMe && setSelectedSlot(s.id)}
                        disabled={isPast || isBookedByMe}
                        className={`rounded-lg border p-3 text-left ${selectedSlot===s.id ? "border-primary bg-primary text-primary-foreground" : isPast ? "opacity-50 bg-muted" : isBookedByMe ? "bg-amber-100 border-amber-300" : "hover:bg-muted"}`}
                      >
                        <p className="text-sm font-medium">{s.startTime}–{s.endTime}</p>
                        <p className="text-xs">{isPast ? "Past" : isBookedByMe ? "Booked by you" : "Available"}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button onClick={book} disabled={!selectedSlot || booking || !amenity.isActive} className="w-full h-11">
              {booking ? "Booking..." : `Book ${amenity.name} • ${todaysSlots.find((s:any)=>s.id===selectedSlot)?.startTime || "Select slot"}`}
            </Button>
            <p className="text-xs text-muted-foreground text-center">One slot per date • Double-booking prevented server-side</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
