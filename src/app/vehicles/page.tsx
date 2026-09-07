"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Car, Plus } from "lucide-react";

type Vehicle = { id: string; numberPlate: string; type: string; stickerNo: string | null; unitId: string; createdAt: string };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{
    fetch("/api/vehicles").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=> setVehicles(Array.isArray(d)? d : [])).catch(()=> setError("Couldn't load vehicles")).finally(()=>setLoading(false));
  }, []);

  if (loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if (error) return <AppShell><div className="max-w-4xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Vehicles" description="Registered vehicles for your unit • Shown at gate for verification" action={<Link href="/vehicles/new"><Button><Plus className="h-4 w-4 mr-2" />Add Vehicle</Button></Link>} />

        {vehicles.length===0 ? (
          <EmptyState icon={<Car className="h-5 w-5" />} title="No vehicles registered" description="Add your car or bike to enable quick gate verification." actionLabel="Add Vehicle" onAction={()=>location.href="/vehicles/new"} />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {vehicles.map(v=>(
              <Link key={v.id} href={`/vehicles/${v.id}`}>
                <Card className="hover:bg-muted/30 h-full">
                  <CardContent className="p-4">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-mono font-bold tracking-widest">{v.numberPlate}</p>
                        <p className="text-xs text-muted-foreground">{v.type} • {v.stickerNo || "No sticker"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Unit {v.unitId.slice(0,8)} • {new Date(v.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="secondary">{v.type}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
