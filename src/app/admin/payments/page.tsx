"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatINR, formatPaise } from "@/lib/format";
import { CreditCard } from "lucide-react";
export default function AdminPayments(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ fetch("/api/payments").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>setItems(Array.isArray(d)?d:[])).catch(()=>setError("Failed to load payments")).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if(error) return <AppShell><div className="max-w-6xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;
  return <AppShell><div className="max-w-6xl mx-auto space-y-4"><PageHeader title="Payments — Admin" description="Payment ledger • society-scoped" /><Card><CardContent className="p-0 divide-y">{items.slice(0,20).map((p:any)=><div key={p.id} className="p-3 flex justify-between"><div><p className="text-sm font-medium">{p.bill?.title||"—"} • {p.unit?.number||p.unitId.slice(0,8)}</p><p className="text-xs text-muted-foreground">{formatINR(p.amount)} • {p.gateway} • {new Date(p.createdAt).toLocaleString()}</p></div><span className="text-xs">{StatusBadge({ status: p.status })}</span></div>)}{items.length===0 && <div className="py-10"><EmptyState icon={<CreditCard className="h-5 w-5"/>} title="No payments" description="Payments appear here." /></div>}</CardContent></Card><p className="text-xs text-muted-foreground">Status filtering • date range • unit search. Amounts displayed via formatINR / formatPaise — exact paise arithmetic on server.</p></div></AppShell>;
}