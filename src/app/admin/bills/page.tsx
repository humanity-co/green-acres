"use client";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { Wallet, Plus } from "lucide-react";
import { amountToPaise } from "@/lib/payments/provider";

function formatINR(s:string){
  try { const paise = amountToPaise(s); return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(paise/100); }
  catch { const n = Number(s); return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(isNaN(n)?0:n); }
}
function paiseToString(p:number){ return (p/100).toFixed(2); }

export default function AdminBills(){
  const [bills, setBills]=useState<any[]>([]);
  const [payments, setPayments]=useState<any[]>([]);
  const [units, setUnits]=useState<any[]>([]);
  const [filterUnit, setFilterUnit]=useState<string>("all");
  const [filterStatus, setFilterStatus]=useState<string>("all");
  const [form, setForm]=useState({ unitId:"", title:"Maintenance", periodStart:"", periodEnd:"", dueDate:"", subtotal:"3500.00", tax:"630.00", total:"4130.00" });
  const [loading, setLoading]=useState(false);

  async function load(){
    const [b,p,u] = await Promise.all([
      fetch("/api/bills").then(r=>r.json()).catch(()=>[]),
      fetch("/api/payments").then(r=>r.json()).catch(()=>[]),
      fetch("/api/units").then(r=>r.json()).catch(()=>[]),
    ]);
    setBills(Array.isArray(b)? b: []);
    setPayments(Array.isArray(p)? p: []);
    setUnits(Array.isArray(u)? u: []);
    if (u[0] && !form.unitId) setForm(f=>({...f, unitId: u[0].id}));
  }
  useEffect(()=>{ load(); }, []);

  const kpis = useMemo(()=>{
    const totalPaise = bills.reduce((sum,b)=> sum + amountToPaise(b.total), 0);
    const paidBills = bills.filter(b=>b.status==="PAID").length;
    const overdue = bills.filter(b=> new Date(b.dueDate) < new Date(new Date().setHours(0,0,0,0)) && b.status!=="PAID").length;
    const outstandingPaise = bills.filter(b=> b.status!=="PAID").reduce((sum,b)=> sum + amountToPaise(b.total), 0) - payments.filter(p=>p.status==="SUCCESS").reduce((sum,p)=> sum + amountToPaise(p.amount), 0);
    return { totalBilledPaise: totalPaise, paidBills, overdue, outstandingPaise: Math.max(0, outstandingPaise) };
  }, [bills, payments]);

  const filtered = bills.filter(b=>{
    if (filterUnit!=="all" && b.unitId!==filterUnit) return false;
    if (filterStatus!=="all" && b.status!==filterStatus) return false;
    return true;
  });

  async function createBill(){
    if (!form.unitId || !form.title || !form.periodStart || !form.periodEnd || !form.dueDate) return toast.error("Fill required fields");
    setLoading(true);
    try {
      const res = await fetch("/api/bills", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Bill created");
      setForm({ unitId: units[0]?.id || "", title:"Maintenance", periodStart:"", periodEnd:"", dueDate:"", subtotal:"3500.00", tax:"630.00", total:"4130.00" });
      load();
    } catch(e:any){ toast.error(e.message || "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Billing — Admin" description="Create bills, inspect ledger, track outstanding • Society-scoped" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Billed</p><p className="text-lg font-semibold">{formatINR(paiseToString(kpis.totalBilledPaise))}</p><p className="text-xs text-muted-foreground">{bills.length} bills</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-semibold text-amber-700">{formatINR(paiseToString(kpis.outstandingPaise))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid Bills</p><p className="text-lg font-semibold text-emerald-600">{kpis.paidBills}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Overdue</p><p className={`text-lg font-semibold ${kpis.overdue ? "text-red-600" : ""}`}>{kpis.overdue}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Create Bill</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-muted-foreground">Billing details</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Unit *</Label>
                  <Select value={form.unitId} onValueChange={v=>setForm({...form, unitId:v})}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {units.slice(0,20).map((u:any)=><SelectItem key={u.id} value={u.id}>{u.number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Maintenance" /></div>
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-muted-foreground">Period</legend>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Period Start *</Label><Input type="date" value={form.periodStart} onChange={e=>setForm({...form, periodStart:e.target.value})} /></div>
                <div className="space-y-1"><Label>Period End *</Label><Input type="date" value={form.periodEnd} onChange={e=>setForm({...form, periodEnd:e.target.value})} /></div>
                <div className="space-y-1"><Label>Due Date *</Label><Input type="date" value={form.dueDate} onChange={e=>setForm({...form, dueDate:e.target.value})} /></div>
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-muted-foreground">Amounts</legend>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Subtotal *</Label><Input inputMode="decimal" value={form.subtotal} onChange={e=>setForm({...form, subtotal:e.target.value})} placeholder="3500.00" /></div>
                <div className="space-y-1"><Label>Tax</Label><Input inputMode="decimal" value={form.tax} onChange={e=>setForm({...form, tax:e.target.value})} placeholder="630.00" /></div>
                <div className="space-y-1"><Label>Total *</Label><Input inputMode="decimal" value={form.total} onChange={e=>setForm({...form, total:e.target.value})} placeholder="4130.00" /></div>
              </div>
            </fieldset>
            <p className="text-xs text-muted-foreground">Amounts as decimal strings (e.g. 4130.00). Server validates total = subtotal + tax, dueDate after periodEnd. Paise-exact.</p>
            <Button onClick={createBill} disabled={loading} size="sm">{loading ? "Creating..." : "Create Bill"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {units.slice(0,20).map((u:any)=><SelectItem key={u.id} value={u.id}>{u.number}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="ISSUED">Issued</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-auto">{filtered.length} bills</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.slice(0,20).map((b:any)=>(
                <div key={b.id} className="flex justify-between px-4 py-3 hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{b.title} • {b.unitId.slice(0,8)}</p>
                    <p className="text-xs text-muted-foreground">{b.periodStart} → {b.periodEnd} • Due {b.dueDate} • {formatINR(b.total)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
              {filtered.length===0 && <p className="text-sm text-muted-foreground text-center py-8">No bills for filter</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Ledger (society)</CardTitle></CardHeader>
          <CardContent>
            {payments.length===0 ? <p className="text-sm text-muted-foreground text-center py-6">No payments yet</p> : (
              <div className="divide-y">
                {payments.slice(0,10).map((p:any)=>(
                  <div key={p.id} className="flex justify-between px-2 py-2">
                    <div><p className="text-sm font-medium">{formatINR(p.amount)} • {p.method} • {p.status}</p><p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()} • {p.gatewayRef?.slice(0,12) || "—"}</p></div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
