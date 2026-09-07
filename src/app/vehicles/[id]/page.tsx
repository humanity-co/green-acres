"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Car, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function VehicleDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState({ type:"", stickerNo:"" });
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    fetch(`/api/vehicles/${params.id}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>{ setVehicle(d); setEdit({ type: d.type, stickerNo: d.stickerNo || "" }); }).catch(()=>{}).finally(()=>setLoading(false));
  }, [params.id]);

  async function save(){
    setSaving(true);
    const res = await fetch(`/api/vehicles/${params.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ type: edit.type, stickerNo: edit.stickerNo || null }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error || "Failed"); else { toast.success("Updated"); setVehicle(d); }
    setSaving(false);
  }

  async function remove(){
    const res = await fetch(`/api/vehicles/${params.id}`, { method:"DELETE" });
    if (res.ok){ toast.success("Removed"); router.push("/vehicles"); } else { const j=await res.json(); toast.error(j.error||"Failed"); }
  }

  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (!vehicle) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center">Not found</CardContent></Card></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/vehicles")}>← Vehicles</Button>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto"><Car className="h-6 w-6" /></div>
            <h1 className="text-xl font-mono font-bold tracking-widest mt-3">{vehicle.numberPlate}</h1>
            <p className="text-sm text-muted-foreground">{vehicle.type} • {vehicle.stickerNo || "No sticker"}</p>
            <Badge variant="secondary" className="mt-2">{vehicle.type}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Edit vehicle</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={edit.type} onValueChange={v=>setEdit({...edit, type:v})}>
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
              <Label htmlFor="sticker">Sticker No</Label>
              <Input id="sticker" value={edit.stickerNo} onChange={e=>setEdit({...edit, stickerNo:e.target.value})} placeholder="STK-001" />
            </div>
            <p className="text-xs text-muted-foreground">Registration number cannot be changed (unique constraint). Delete and re-add if needed.</p>
            <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving..." : "Save changes"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span className="font-mono">{vehicle.unitId.slice(0,8)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Registered</span><span>{new Date(vehicle.createdAt).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span className="font-mono">{vehicle.userId.slice(0,8)}</span></div>
          </CardContent>
        </Card>

        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="w-full"><Trash2 className="h-4 w-4 mr-2" />Remove Vehicle</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Remove vehicle?</AlertDialogTitle><AlertDialogDescription>This will delete {vehicle.numberPlate} from your unit.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Remove</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
