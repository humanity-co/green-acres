"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Download } from "lucide-react";
function paiseToINR(p:number){ return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(p/100); }
export default function FinanceReport(){
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ fetch("/api/admin/reports/finance").then(r=>r.json()).then(setData).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><div className="h-32 bg-muted animate-pulse rounded-xl"/></div></AppShell>;
  if(!data) return <AppShell><div className="max-w-6xl mx-auto"><Card><CardContent className="py-10 text-center">Failed</CardContent></Card></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Finance Report" description="Paise-exact aggregation • bills and payments" action={<Button size="sm" variant="outline" onClick={()=>window.location.href="/api/admin/export/finance"}><Download className="h-4 w-4 mr-1"/>CSV</Button>} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Billed" value={paiseToINR(data.totalBilledPaise)} icon={<Wallet className="h-4 w-4"/>} sub={`${data.billCount} bills`} />
          <StatCard label="Collected" value={paiseToINR(data.collectedPaise)} icon={<Wallet className="h-4 w-4"/>} />
          <StatCard label="Outstanding" value={paiseToINR(data.outstandingPaise)} icon={<Wallet className="h-4 w-4"/>} />
          <StatCard label="Overdue" value={data.overdueCount} icon={<Wallet className="h-4 w-4"/>} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Bills by Status</CardTitle></CardHeader><CardContent className="divide-y">
          {Object.entries(data.billByStatus||{}).map(([k,v]:any)=><div key={k} className="flex justify-between py-2"><span className="text-sm">{k}</span><span className="text-sm font-medium">{v.count} • {paiseToINR(v.paise)}</span></div>)}
          {Object.keys(data.billByStatus||{}).length===0 && <p className="text-xs text-muted-foreground py-4 text-center">No bills</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Payments by Status</CardTitle></CardHeader><CardContent className="divide-y">
          {Object.entries(data.paymentByStatus||{}).map(([k,v]:any)=><div key={k} className="flex justify-between py-2"><span className="text-sm">{k}</span><Badge variant={k==="SUCCESS"?"default":"secondary"}>{String(v)}</Badge></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Recent Payments</CardTitle></CardHeader><CardContent className="divide-y">
          {data.recentPayments?.length ? data.recentPayments.map((p:any)=><div key={p.id} className="flex justify-between py-2"><span className="text-sm">{paiseToINR((()=>{try{return parseInt(p.amount)*100}catch{return 0}})())} {p.amount}</span><Badge variant={p.status==="SUCCESS"?"default":"secondary"}>{p.status}</Badge></div>) : <p className="text-xs text-muted-foreground py-4 text-center">No payments</p>}
        </CardContent></Card>
      </div>
    </AppShell>
  );
}
