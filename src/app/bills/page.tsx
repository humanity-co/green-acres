"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Wallet, Calendar, AlertTriangle } from "lucide-react";
import { formatINR } from "@/lib/format";

type Bill = { id: string; title: string; periodStart: string; periodEnd: string; dueDate: string; total: string; status: string; unitId: string; createdAt: string };

export default function BillsPage(){
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading]=useState(true);
  const [error, setError]=useState<string|null>(null);
  const [tab, setTab]=useState("outstanding");

  useEffect(()=>{
    fetch("/api/bills").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=> setBills(Array.isArray(d)? d: [])).catch(()=> setError("Couldn't load bills")).finally(()=>setLoading(false));
  },[]);

  const now = new Date(); now.setHours(0,0,0,0);
  const derived = useMemo(()=> bills.map(b=>{
    const due = new Date(b.dueDate); due.setHours(0,0,0,0);
    const isOverdue = due < now && b.status!=="PAID" && b.status!=="CANCELLED";
    const isDueSoon = due >= now && due.getTime() - now.getTime() <= 7*86400000 && b.status!=="PAID";
    return {...b, isOverdue, isDueSoon};
  }), [bills]);

  const filtered = useMemo(()=>{
    if(tab==="outstanding") return derived.filter(b=> b.status==="ISSUED" || b.status==="PARTIAL" || b.status==="OVERDUE");
    if(tab==="dueSoon") return derived.filter(b=> b.isDueSoon);
    if(tab==="overdue") return derived.filter(b=> b.isOverdue);
    if(tab==="paid") return derived.filter(b=> b.status==="PAID");
    if(tab==="history") return derived;
    return derived;
  }, [derived, tab]);

  const counts = {
    outstanding: derived.filter(b=> b.status==="ISSUED" || b.status==="PARTIAL" || b.status==="OVERDUE").length,
    dueSoon: derived.filter(b=> b.isDueSoon).length,
    overdue: derived.filter(b=> b.isOverdue).length,
    paid: derived.filter(b=> b.status==="PAID").length,
  };

  if(loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if(error) return <AppShell><div className="max-w-4xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p></CardContent></Card></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Bills" description="Maintenance and society charges • Pay before due date" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-semibold">{counts.outstanding}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Due Soon (7d)</p><p className="text-lg font-semibold">{counts.dueSoon}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Overdue</p><p className={`text-lg font-semibold ${counts.overdue ? "text-red-600" : ""}`}>{counts.overdue}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-lg font-semibold">{counts.paid}</p></CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full overflow-x-auto gap-1 h-10 p-1 justify-start">
            <TabsTrigger value="outstanding" className="text-xs whitespace-nowrap shrink-0">Outstanding {counts.outstanding>0 && <Badge variant="secondary" className="ml-1 px-1">{counts.outstanding}</Badge>}</TabsTrigger>
            <TabsTrigger value="dueSoon" className="text-xs whitespace-nowrap shrink-0">Due Soon</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs whitespace-nowrap shrink-0">Overdue {counts.overdue>0 && <Badge variant="secondary" className="ml-1 px-1 bg-red-600 text-white">{counts.overdue}</Badge>}</TabsTrigger>
            <TabsTrigger value="paid" className="text-xs whitespace-nowrap shrink-0">Paid</TabsTrigger>
            <TabsTrigger value="history" className="text-xs whitespace-nowrap shrink-0">History</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length===0 ? (
          <EmptyState icon={<Wallet className="h-5 w-5" />} title={tab==="outstanding" ? "No outstanding bills" : tab==="overdue" ? "No overdue bills" : tab==="paid" ? "No paid bills" : "No bills"} description="Bills issued by accounts appear here. Outstanding must be paid before due date." />
        ) : (
          <div className="space-y-3">
            {filtered.map(b=>(
              <Link key={b.id} href={`/bills/${b.id}`}>
                <Card className={`hover:bg-muted/30 ${b.isOverdue ? "border-l-4 border-l-red-500" : b.isDueSoon ? "border-l-4 border-l-amber-500" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{b.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{b.periodStart} → {b.periodEnd} • Due {b.dueDate}</p>
                        <p className="text-sm font-medium mt-1">{formatINR(b.total)} {b.isOverdue && <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3 w-3" />Overdue</span>}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={b.isOverdue ? "OVERDUE" : b.status} />
                        <span className="text-xs text-muted-foreground">Unit {b.unitId.slice(0,8)}</span>
                      </div>
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
