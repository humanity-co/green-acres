"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download } from "lucide-react";
export default function AmenitiesReport(){
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ fetch("/api/admin/reports/amenities").then(r=>r.json()).then(setData).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><div className="h-32 bg-muted animate-pulse rounded-xl"/></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Amenity Report" description="Bookings and utilization" action={<Button size="sm" variant="outline" onClick={()=>window.location.href="/api/admin/export/bookings"}><Download className="h-4 w-4 mr-1"/>CSV</Button>} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Total Bookings" value={data.totalBookings} icon={<Calendar className="h-4 w-4"/>} />
          <StatCard label="Cancelled" value={data.cancelled} icon={<Calendar className="h-4 w-4"/>} />
          <StatCard label="Amenities" value={data.amenityCount} icon={<Calendar className="h-4 w-4"/>} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Most Used Amenities</CardTitle></CardHeader><CardContent className="divide-y">
          {data.mostUsed?.length ? data.mostUsed.map((m:any)=><div key={m.amenityId} className="flex justify-between py-2"><span className="text-sm">{m.name}</span><span className="text-sm font-medium">{m.count}</span></div>) : <p className="text-xs text-muted-foreground py-4 text-center">No bookings</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Bookings by Date (last 10)</CardTitle></CardHeader><CardContent className="divide-y">
          {data.byDate?.length ? data.byDate.map(([d,c]:any)=><div key={d} className="flex justify-between py-2"><span className="text-sm">{d}</span><span className="text-sm">{c}</span></div>) : <p className="text-xs text-muted-foreground py-4 text-center">No data</p>}
        </CardContent></Card>
        <Card><CardContent className="p-3 text-xs text-muted-foreground">{data.note}</CardContent></Card>
      </div>
    </AppShell>
  );
}
