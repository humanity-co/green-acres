"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Building2, Car } from "lucide-react";

export default function ParkingPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch("/api/parking").then(r=>r.json()).then(d=> setSlots(Array.isArray(d)? d : [])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  if (loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Parking" description="Slots assigned to your unit • Contact admin for allocation" />

        {slots.length===0 ? (
          <EmptyState icon={<Building2 className="h-5 w-5" />} title="No parking assigned" description="Parking is assigned by society admin to your unit. Allocated slots appear here." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {slots.map((s:any)=>(
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.number}</p>
                      <p className="text-xs text-muted-foreground">{s.type} • Building {s.buildingId ? s.buildingId.slice(0,6) : "—"}</p>
                      <p className="text-xs mt-1">Unit {s.unitId ? s.unitId.slice(0,8) : "Unassigned"}</p>
                    </div>
                    <Badge variant={s.unitId ? "default" : "outline"}>{s.unitId ? "Assigned" : "Available"}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
