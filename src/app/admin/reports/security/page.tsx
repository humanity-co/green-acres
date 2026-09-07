"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Truck, HeartHandshake, Car, Users, Download } from "lucide-react";
export default function SecurityReport(){
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ fetch("/api/admin/reports/security").then(r=>r.json()).then(setData).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><div className="h-32 bg-muted animate-pulse rounded-xl"/></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Security Report" description="Visitor and operational traffic" action={<Button size="sm" variant="outline" onClick={()=>window.location.href="/api/admin/export/security"}><Download className="h-4 w-4 mr-1"/>CSV</Button>} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Entries" value={data.totalEntries} icon={<Shield className="h-4 w-4"/>} />
          <StatCard label="Today" value={data.todayEntries} icon={<Users className="h-4 w-4"/>} />
          <StatCard label="Inside Now" value={data.inside} icon={<Shield className="h-4 w-4"/>} />
          <StatCard label="Vehicles" value={data.vehicles} icon={<Car className="h-4 w-4"/>} />
          <StatCard label="Deliveries Pending" value={data.deliveriesPending} sub={`${data.deliveriesTotal} total`} icon={<Truck className="h-4 w-4"/>} />
          <StatCard label="Help Inside" value={data.helpInside} icon={<HeartHandshake className="h-4 w-4"/>} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Recent Entries</CardTitle></CardHeader><CardContent className="divide-y">
          {data.recentEntries?.length ? data.recentEntries.map((e:any)=><div key={e.id} className="flex justify-between py-2"><span className="text-sm">{e.visitorId.slice(0,8)} → {e.unitId.slice(0,8)}</span><span className="text-xs text-muted-foreground">{new Date(e.checkIn).toLocaleString()} {e.checkOut? `→ ${new Date(e.checkOut).toLocaleString()}`:"• INSIDE"}</span></div>) : <p className="text-xs text-muted-foreground py-4 text-center">No entries</p>}
        </CardContent></Card>
        <Card><CardContent className="p-3 text-xs text-muted-foreground">{data.note}</CardContent></Card>
      </div>
    </AppShell>
  );
}
