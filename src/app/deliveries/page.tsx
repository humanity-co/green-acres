"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Package, Clock, Truck } from "lucide-react";

type Delivery = { id: string; courierName: string | null; awb: string | null; status: string; unitId: string; createdAt: string; collectedAt: string | null };

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("pending");
  const [unitsMap, setUnitsMap] = useState<Map<string, string>>(new Map());

  useEffect(()=>{
    async function load(){
      try {
        const [d, u] = await Promise.all([
          fetch("/api/deliveries").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }),
          fetch("/api/units").then(r=>r.json()).catch(()=>[]),
        ]);
        setDeliveries(Array.isArray(d)? d : []);
        if (Array.isArray(u)) setUnitsMap(new Map(u.map((x:any)=>[x.id, x.number])));
      } catch { setError("Couldn't load deliveries"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = useMemo(()=>{
    if (tab==="pending") return deliveries.filter(d=>d.status==="AT_GATE");
    if (tab==="collected") return deliveries.filter(d=>d.status==="COLLECTED");
    if (tab==="today") {
      const today = new Date(); today.setHours(0,0,0,0);
      return deliveries.filter(d=> new Date(d.createdAt) >= today);
    }
    return deliveries;
  }, [deliveries, tab]);

  const pendingCount = deliveries.filter(d=>d.status==="AT_GATE").length;

  if (loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if (error) return <AppShell><div className="max-w-4xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Deliveries" description="Packages received at gate • Collect when ready" />
        {pendingCount>0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Package className="h-5 w-5 text-amber-700" /><div><p className="text-sm font-semibold">{pendingCount} ready for pickup</p><p className="text-xs text-muted-foreground">At gate • Collect soon</p></div></div>
              <Badge className="bg-amber-600">READY</Badge>
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="text-xs">Pending {pendingCount>0 && <Badge variant="secondary" className="ml-1 px-1">{pendingCount}</Badge>}</TabsTrigger>
            <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
            <TabsTrigger value="collected" className="text-xs">Collected</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length===0 ? (
          <EmptyState icon={<Package className="h-5 w-5" />} title={tab==="pending" ? "No deliveries waiting" : tab==="collected" ? "No collected history" : "No deliveries yet"} description="Deliveries recorded by guard appear here." />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filtered.map(d=>(
                <Link key={d.id} href={`/deliveries/${d.id}`}>
                  <Card className="hover:bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{d.courierName || "Courier"}</p>
                          <p className="text-xs text-muted-foreground">AWB {d.awb || "—"} • Unit {unitsMap.get(d.unitId) || d.unitId.slice(0,8)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{new Date(d.createdAt).toLocaleString()}</p>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <Card className="hidden md:block">
              <div className="divide-y">
                {filtered.map(d=>(
                  <Link key={d.id} href={`/deliveries/${d.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><Truck className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{d.courierName} <span className="text-muted-foreground font-normal">• {d.awb || "No AWB"}</span></p>
                      <p className="text-xs text-muted-foreground">Unit {unitsMap.get(d.unitId) || d.unitId.slice(0,8)} • {new Date(d.createdAt).toLocaleString()}</p>
                    </div>
                    <StatusBadge status={d.status} />
                  </Link>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
