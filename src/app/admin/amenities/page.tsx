"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Clock } from "lucide-react";

export default function AdminAmenities() {
  const [amenities, setAmenities] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [newAmenity, setNewAmenity] = useState({ name:"", type:"OTHER", capacity:"10", fee:"0" });
  const [selected, setSelected] = useState<string | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [newSlot, setNewSlot] = useState({ dayOfWeek:"1", startTime:"10:00", endTime:"12:00" });

  async function load(){
    const [a, b] = await Promise.all([
      fetch("/api/amenities").then(r=>r.json()).catch(()=>[]),
      fetch("/api/bookings").then(r=>r.json()).catch(()=>[]),
    ]);
    setAmenities(Array.isArray(a)? a: []);
    setBookings(Array.isArray(b)? b: []);
    if (selected) {
      const s = await fetch(`/api/amenities/${selected}/slots`).then(r=>r.json()).catch(()=>[]);
      setSlots(Array.isArray(s)? s: []);
    }
  }
  useEffect(()=>{ load(); }, []);
  useEffect(()=>{ if(selected) fetch(`/api/amenities/${selected}/slots`).then(r=>r.json()).then(d=> setSlots(Array.isArray(d)? d: [])).catch(()=>{}); }, [selected]);

  async function createAmenity(){
    if (!newAmenity.name) return toast.error("Name required");
    const res = await fetch("/api/amenities", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ name: newAmenity.name, type: newAmenity.type, capacity: parseInt(newAmenity.capacity), fee: newAmenity.fee }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error||"Failed"); else { toast.success("Amenity created"); setNewAmenity({ name:"", type:"OTHER", capacity:"10", fee:"0" }); load(); }
  }

  async function toggleActive(a:any){
    const res = await fetch(`/api/amenities/${a.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ isActive: !a.isActive }) });
    if (!res.ok) toast.error("Failed"); else { toast.success(a.isActive ? "Deactivated" : "Activated"); load(); }
  }

  async function createSlot(){
    if (!selected) return toast.error("Select amenity");
    const res = await fetch(`/api/amenities/${selected}/slots`, { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ dayOfWeek: parseInt(newSlot.dayOfWeek), startTime: newSlot.startTime, endTime: newSlot.endTime }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error||"Failed"); else { toast.success("Slot created"); setNewSlot({ dayOfWeek:"1", startTime:"10:00", endTime:"12:00" }); fetch(`/api/amenities/${selected}/slots`).then(r=>r.json()).then(d=> setSlots(Array.isArray(d)? d: [])); }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-4">
        <PageHeader title="Amenities — Admin" description="Manage amenities, slots and bookings • Society-scoped" />

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Create Amenity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1"><Label>Name *</Label><Input value={newAmenity.name} onChange={e=>setNewAmenity({...newAmenity, name:e.target.value})} placeholder="Swimming Pool" /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={newAmenity.type} onValueChange={v=>setNewAmenity({...newAmenity, type:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POOL">Pool</SelectItem><SelectItem value="GYM">Gym</SelectItem><SelectItem value="CLUBHOUSE">Clubhouse</SelectItem><SelectItem value="PARK">Park</SelectItem><SelectItem value="HALL">Hall</SelectItem><SelectItem value="SPORTS">Sports</SelectItem><SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Capacity</Label><Input type="number" value={newAmenity.capacity} onChange={e=>setNewAmenity({...newAmenity, capacity:e.target.value})} /></div>
              <div className="space-y-1"><Label>Fee</Label><Input value={newAmenity.fee} onChange={e=>setNewAmenity({...newAmenity, fee:e.target.value})} placeholder="0" /></div>
            </div>
            <Button onClick={createAmenity} size="sm">Create</Button>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Amenities ({amenities.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {amenities.map((a:any)=>(
                <div key={a.id} className={`flex justify-between items-center rounded-lg border p-3 ${selected===a.id ? "bg-muted" : ""}`}>
                  <div onClick={()=>setSelected(a.id)} className="cursor-pointer flex-1">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.type} • Cap {a.capacity} • {a.isActive ? "Active" : "Inactive"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant={a.isActive ? "default" : "secondary"}>{a.isActive ? "Active" : "Inactive"}</Badge>
                    <Button size="sm" variant="outline" onClick={()=>toggleActive(a)}>{a.isActive ? "Deactivate" : "Activate"}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Slots {selected ? `for ${amenities.find((a:any)=>a.id===selected)?.name}` : "(select amenity)"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {selected ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1"><Label>Day 0-6</Label><Input value={newSlot.dayOfWeek} onChange={e=>setNewSlot({...newSlot, dayOfWeek:e.target.value})} /></div>
                      <div className="space-y-1"><Label>Start</Label><Input type="time" value={newSlot.startTime} onChange={e=>setNewSlot({...newSlot, startTime:e.target.value})} /></div>
                      <div className="space-y-1"><Label>End</Label><Input type="time" value={newSlot.endTime} onChange={e=>setNewSlot({...newSlot, endTime:e.target.value})} /></div>
                    </div>
                    <Button size="sm" onClick={createSlot} disabled={!selected}>Add Slot</Button>
                    <div className="space-y-2 mt-2">
                      {slots.map((s:any)=>(
                        <div key={s.id} className="flex justify-between rounded border px-3 py-2 text-sm">
                          <span>Day {s.dayOfWeek} • {s.startTime}–{s.endTime}</span>
                          <span className="text-muted-foreground">{s.id.slice(0,6)}</span>
                        </div>
                      ))}
                      {slots.length===0 && <p className="text-sm text-muted-foreground text-center py-4">No slots for this amenity</p>}
                    </div>
                  </>
                ) : <p className="text-sm text-muted-foreground">Select an amenity to manage slots</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Bookings ({bookings.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-auto">
                {bookings.slice(0,10).map((b:any)=>(
                  <div key={b.booking.id} className="flex justify-between rounded border px-3 py-2">
                    <div><p className="text-sm font-medium">{b.amenity?.name || b.booking.amenityId.slice(0,8)}</p><p className="text-xs text-muted-foreground">{b.booking.bookingDate} • {b.slot ? `${b.slot.startTime}–${b.slot.endTime}` : "No slot"} • {b.booking.status}</p></div>
                    <Badge variant={b.booking.status==="CANCELLED" ? "outline" : "default"}>{b.booking.status}</Badge>
                  </div>
                ))}
                {bookings.length===0 && <p className="text-sm text-muted-foreground text-center py-4">No bookings yet</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
