"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Truck } from "lucide-react";
export default function AdminDeliveries(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ fetch("/api/deliveries").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>setItems(Array.isArray(d)?d:[])).catch(()=>setError("Failed to load deliveries")).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if(error) return <AppShell><div className="max-w-6xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;
  const statuses = ["AT_GATE","COLLECTED","DELIVERED","RETURNED","FAILED"];
  return <AppShell><div className="max-w-6xl mx-auto space-y-4"><PageHeader title="Deliveries — Admin" description="Gate deliveries • society-scoped" /><Card><CardContent className="p-0 divide-y">{items.slice(0,20).map((d:any)=><div key={d.id} className="flex justify-between p-3"><div className="flex items-center gap-3"><div><p className="text-sm font-medium">{d.courierName}</p><p className="text-xs text-muted-foreground">{d.awb||"No AWB"} • {new Date(d.createdAt).toLocaleString()}</p></div><span className="text-xs mr-3">{d.status}</span></div><div className="text-right">{StatusBadge({ status: d.status })}</div></div>)}{items.length===0 && <div className="py-10"><EmptyState icon={<Truck className="h-5 w-5"/>} title="No deliveries" description="Deliveries appear here." /></div>}</CardContent></Card></div></AppShell>;
}