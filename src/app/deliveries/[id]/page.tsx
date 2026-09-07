"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { Package, Clock, MapPin, Truck } from "lucide-react";

export default function DeliveryDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);

  useEffect(()=>{
    fetch(`/api/deliveries/${params.id}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  }, [params.id]);

  async function collect(){
    setCollecting(true);
    const res = await fetch(`/api/deliveries/${params.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status:"COLLECTED" }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error || "Failed"); else { toast.success("Marked as collected"); setData((prev:any)=>({...prev, delivery: d})); }
    setCollecting(false);
  }

  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (!data) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">Not found or not authorized</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>router.push("/deliveries")}>Back</Button></CardContent></Card></div></AppShell>;

  const { delivery, unit } = data;
  const canCollect = delivery.status==="AT_GATE";

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/deliveries")}>← Deliveries</Button>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto"><Package className="h-6 w-6" /></div>
            <h1 className="text-lg font-semibold mt-3">{delivery.courierName}</h1>
            <p className="text-sm text-muted-foreground">AWB {delivery.awb || "—"} • {unit?.number || delivery.unitId.slice(0,8)}</p>
            <div className="mt-2"><StatusBadge status={delivery.status} /></div>
            <p className="text-xs text-muted-foreground mt-2">Received {new Date(delivery.createdAt).toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" />Courier</span><span className="font-medium">{delivery.courierName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">AWB</span><span className="font-mono text-xs">{delivery.awb || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Unit</span><span className="font-medium">{unit?.number || delivery.unitId.slice(0,8)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Received</span><span>{new Date(delivery.createdAt).toLocaleString()}</span></div>
            {delivery.collectedAt && <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span>{new Date(delivery.collectedAt).toLocaleString()}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={delivery.status==="AT_GATE" ? "default" : "secondary"} className={delivery.status==="AT_GATE" ? "bg-amber-600" : ""}>{delivery.status}</Badge></div>
          </CardContent>
        </Card>

        {canCollect ? (
          <Button className="w-full h-12 text-base" onClick={collect} disabled={collecting}>{collecting ? "Updating..." : "Mark as Collected"}</Button>
        ) : (
          <Button variant="outline" className="w-full" disabled>{delivery.status==="COLLECTED" ? "Already collected" : delivery.status}</Button>
        )}
        <p className="text-xs text-muted-foreground text-center">Only residents of {unit?.number || "this unit"} can collect. Guard updates are audited.</p>
      </div>
    </AppShell>
  );
}
