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
import { Car } from "lucide-react";

export default function NewVehiclePage() {
  const router = useRouter();
  const [units, setUnits] = useState<any[]>([]);
  const [form, setForm] = useState({ numberPlate:"", type:"CAR", stickerNo:"", unitId:"" });
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ fetch("/api/units").then(r=>r.json()).then(d=>{ if(Array.isArray(d)&&d.length){ setUnits(d); setForm(f=>({...f, unitId:d[0].id})); }}).catch(()=>{}); }, []);

  async function submit(e: React.FormEvent){
    e.preventDefault();
    if (!form.numberPlate) return toast.error("Enter registration number");
    setLoading(true);
    try {
      const res = await fetch("/api/vehicles", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Vehicle registered");
      router.push(`/vehicles/${data.id}`);
    } catch(e:any){ toast.error(e.message || "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <PageHeader title="Add Vehicle" description="Registration visible to guard at gate • Unique per society" />
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Car className="h-4 w-4" />Vehicle details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plate">Registration number *</Label>
                <Input id="plate" value={form.numberPlate} onChange={e=>setForm({...form, numberPlate:e.target.value})} placeholder="KA01AB1234" required className="font-mono uppercase" />
                <p className="text-xs text-muted-foreground">Auto-normalized: spaces/hyphens removed, uppercase. Must be unique in society.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select value={form.type} onValueChange={v=>setForm({...form, type:v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAR">Car</SelectItem>
                      <SelectItem value="MOTORCYCLE">Motorcycle</SelectItem>
                      <SelectItem value="SCOOTER">Scooter</SelectItem>
                      <SelectItem value="EV">Electric Vehicle</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sticker">Sticker No (optional)</Label>
                  <Input id="sticker" value={form.stickerNo} onChange={e=>setForm({...form, stickerNo:e.target.value})} placeholder="STK-001" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unit *</Label>
                <Select value={form.unitId} onValueChange={v=>setForm({...form, unitId:v})}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u:any)=><SelectItem key={u.id} value={u.id}>{u.number} • {u.type}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Only units you are member of. Admin can assign for any unit.</p>
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={()=>router.push("/vehicles")}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Adding..." : "Add Vehicle"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
