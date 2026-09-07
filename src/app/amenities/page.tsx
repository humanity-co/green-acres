"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Calendar, Clock, Users, MapPin } from "lucide-react";

export default function AmenitiesPage() {
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{
    fetch("/api/amenities").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=> setAmenities(Array.isArray(d)? d : [])).catch(()=> setError("Couldn't load amenities")).finally(()=>setLoading(false));
  }, []);

  if (loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={3} /></div></AppShell>;
  if (error) return <AppShell><div className="max-w-4xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Amenities" description="Swimming pool, gym, clubhouse and more • Book your slot" />
        {amenities.length===0 ? (
          <EmptyState icon={<Calendar className="h-5 w-5" />} title="No amenities available" description="Society admin will add amenities like pool and gym soon." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {amenities.map((a:any)=>(
              <Link key={a.id} href={`/amenities/${a.id}`}>
                <Card className="hover:bg-muted/30 h-full">
                  <CardContent className="p-4">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.type} • Capacity {a.capacity}</p>
                        {a.rules && <p className="text-xs line-clamp-2 mt-1">{a.rules}</p>}
                        <p className="text-xs flex items-center gap-1 mt-2"><Users className="h-3 w-3" />{a.isActive ? "Available" : "Inactive"}</p>
                      </div>
                      <Badge variant={a.isActive ? "default" : "secondary"}>{a.fee==="0" || a.fee==="0.00" ? "Free" : `₹${a.fee}`}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Slots available</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Society</span>
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
