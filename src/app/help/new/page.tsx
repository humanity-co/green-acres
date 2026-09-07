"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HeartHandshake } from "lucide-react";

export default function NewHelpPage() {
  const router = useRouter();
  const [units, setUnits] = useState<any[]>([]);
  const [form, setForm] = useState({ name:"", phone:"", category:"MAID", unitId:"" });
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ fetch("/api/units").then(r=>r.json()).then(d=>{ if(Array.isArray(d)&&d.length){ setUnits(d); setForm(f=>({...f, unitId:d[0].id})); }}).catch(()=>{}); }, []);

  async function submit(e: React.FormEvent){
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error("Fill name and phone");
    if (!/^\+?\d{10,15}$/.test(form.phone.replace(/\s/g,""))) return toast.error("Invalid phone");
    setLoading(true);
    try{
      const res = await fetch("/api/help", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Domestic help added");
      router.push(`/help/${data.help.id}`);
    } catch(e:any){ toast.error(e.message || "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <PageHeader title="Add Domestic Help" description="Create a pass for your home help — gate will verify daily" />
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><HeartHandshake className="h-4 w-4" />Help details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="name">Name *</Label><Input id="name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g. Lakshmi" required /></div>
                <div className="space-y-2"><Label htmlFor="phone">Phone *</Label><Input id="phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="98765 43210" required /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Category *</Label>
                  <Select value={form.category} onValueChange={v=>setForm({...form, category:v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAID">Maid</SelectItem>
                      <SelectItem value="COOK">Cook</SelectItem>
                      <SelectItem value="DRIVER">Driver</SelectItem>
                      <SelectItem value="NANNY">Nanny</SelectItem>
                      <SelectItem value="GARDENER">Gardener</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Unit *</Label>
                  <Select value={form.unitId} onValueChange={v=>setForm({...form, unitId:v})}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u:any)=><SelectItem key={u.id} value={u.id}>{u.number} • {u.type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Help will be linked to this unit. Guard will check-in at gate. Schedule can be added later.</p>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={()=>router.push("/help")}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Adding..." : "Add Help"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
