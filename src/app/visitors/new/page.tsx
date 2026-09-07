"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Share2, Check, Calendar, User } from "lucide-react";
import { VisitorPassCard } from "@/components/shared/VisitorPassCard";

export default function InviteVisitorPage() {
  const router = useRouter();
  const [units, setUnits] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", purpose: "Guest", visitDate: new Date().toISOString().slice(0,10), validFrom: "", validTo: "", unitId: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch("/api/me/units")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) {
          const userUnits = d.map((item: any) => item.unit || item);
          setUnits(userUnits);
          setForm((f) => ({ ...f, unitId: userUnits[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.purpose) return toast.error("Fill required fields");
    if (!/^\+?\d{10,15}$/.test(form.phone.replace(/\s/g, ""))) return toast.error("Invalid phone");
    setLoading(true);
    try {
      const now = new Date();
      let validFromDate = form.validFrom
        ? new Date(`${form.visitDate}T${form.validFrom}`)
        : new Date(`${form.visitDate}T09:00`);
      let validToDate = form.validTo
        ? new Date(`${form.visitDate}T${form.validTo}`)
        : new Date(`${form.visitDate}T23:59`);

      // If validTo is in the past (e.g. creating a pass late in the evening), extend it to next day or minimum 4 hours
      if (validToDate.getTime() <= now.getTime()) {
        validToDate = new Date(now.getTime() + 4 * 3600000);
      }

      const validFrom = validFromDate.toISOString();
      const validTo = validToDate.toISOString();

      const res = await fetch("/api/visitors/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          purpose: form.purpose,
          validFrom,
          validTo,
          unitId: form.unitId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      toast.success("Invitation created");
    } catch (e: any) {
      toast.error(e.message || "Failed to create invite");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const invite = result.invite;
    const visitor = result.visitor;
    const unit = units.find(u => u.id === (form.unitId || invite.unitId));

    return (
      <AppShell>
        <div className="max-w-md mx-auto space-y-6 py-4">
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 font-mono">
              Pass Issued Successfully
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Visitor Pass for {visitor.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              Share this pass via WhatsApp or system sheet for instant gate entry.
            </p>
          </div>

          <VisitorPassCard
            pass={{
              code: invite.code,
              visitorName: visitor.name,
              visitorPhone: visitor.phone,
              unitNumber: unit?.number || "A-101",
              societyName: "Green Acres Residency",
              purpose: invite.purpose,
              validFrom: invite.validFrom,
              validTo: invite.validTo,
            }}
            onClose={() => router.push("/visitors")}
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-xs" onClick={() => router.push("/visitors")}>
              View All Visitors
            </Button>
            <Button className="flex-1 text-xs" onClick={() => setResult(null)}>
              Create Another Pass
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <PageHeader title="Invite Visitor" description="Create a gate pass — guard will verify code at entry" />
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Visitor details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Visitor name *</Label>
                  <Input id="name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g. Amit Kumar" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number *</Label>
                  <Input id="phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="98765 43210" required />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purpose *</Label>
                  <Select value={form.purpose} onValueChange={v=>setForm({...form, purpose:v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Guest">Guest</SelectItem>
                      <SelectItem value="Family">Family / Friend</SelectItem>
                      <SelectItem value="Service Provider">Service Provider</SelectItem>
                      <SelectItem value="Cab / Driver">Cab / Driver</SelectItem>
                      <SelectItem value="Delivery">Delivery</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Host unit</Label>
                  <Select value={form.unitId} onValueChange={v=>setForm({...form, unitId:v})}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u:any)=><SelectItem key={u.id} value={u.id}>{u.number} • {u.type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Visit window</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Visit date *</Label>
                <Input id="date" type="date" value={form.visitDate} onChange={e=>setForm({...form, visitDate:e.target.value})} required />
                <p className="text-xs text-muted-foreground">Defaults to today 09:00–21:00. Adjust if needed.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from">Valid from (optional)</Label>
                  <Input id="from" type="time" value={form.validFrom} onChange={e=>setForm({...form, validFrom:e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to">Valid until (optional)</Label>
                  <Input id="to" type="time" value={form.validTo} onChange={e=>setForm({...form, validTo:e.target.value})} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={()=>router.push("/visitors")}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Creating..." : "Create invite"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
