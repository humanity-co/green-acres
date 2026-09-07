"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export default function AdminParkingPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  async function load(){
    const [s, u] = await Promise.all([
      fetch("/api/parking").then(r=>r.json()).catch(()=>[]),
      fetch("/api/units").then(r=>r.json()).catch(()=>[]),
    ]);
    setSlots(Array.isArray(s)? s: []); setUnits(Array.isArray(u)? u: []);
  }
  useEffect(()=>{ load(); }, []);

  async function assign(slotId: string, unitId: string | null){
    const res = await fetch(`/api/parking/${slotId}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ unitId }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error || "Failed"); else { toast.success(unitId ? "Assigned" : "Unassigned"); load(); }
  }

  const available = slots.filter(s=>!s.unitId).length;
  const assigned = slots.filter(s=>s.unitId).length;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-4">
        <PageHeader title="Parking Management" description="Assign slots to authorized units • Society-scoped" />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold">{slots.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Assigned</p><p className="text-xl font-semibold">{assigned}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Available</p><p className="text-xl font-semibold">{available}</p></CardContent></Card>
        </div>

        {slots.length===0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No parking slots yet. Seed data has none — admin can create via DB.</CardContent></Card>
        ) : (
          <Card>
            <div className="divide-y">
              {slots.map((s:any)=>(
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.number} • {s.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.unitId ? `Assigned to Unit ${units.find((u: any) => u.id === s.unitId)?.number || s.unitId.slice(0, 8)}` : "Unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.unitId ? "default" : "outline"}>{s.unitId ? "Assigned" : "Available"}</Badge>
                    <Select onValueChange={v => assign(s.id, v === "none" ? null : v)}>
                      <SelectTrigger className="w-40 h-8"><span className="text-xs">Assign Unit</span></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="none">Unassign</SelectItem>
                        {units.map((u: any) => <SelectItem key={u.id} value={u.id}>Unit {u.number}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
