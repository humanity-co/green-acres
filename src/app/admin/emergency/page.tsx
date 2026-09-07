"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Siren } from "lucide-react";
export default function AdminEmergency() {
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState("FIRE");
  const load = async()=>{ const r=await fetch("/api/emergency"); const d=await r.json(); setItems(Array.isArray(d)?d:[]); };
  useEffect(()=>{ load(); },[]);
  const create = async()=>{
    const r=await fetch("/api/emergency",{ method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ type })});
    if(!r.ok){ const d=await r.json(); return toast.error(d.error||"Failed"); }
    toast.success("Alert created"); load();
  };
  const resolve = async(id:string, status:string)=>{
    const r=await fetch(`/api/emergency/${id}`,{ method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status })});
    if(!r.ok) return toast.error("Failed");
    toast.success(`Marked ${status}`); load();
  };
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Emergency — Admin" description="Create and resolve alerts • strict RBAC" />
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Siren className="h-4 w-4" />Create Alert</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Type *</Label><Select value={type} onValueChange={setType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIRE">Fire</SelectItem><SelectItem value="MEDICAL">Medical</SelectItem><SelectItem value="SECURITY">Security</SelectItem><SelectItem value="WATER">Water</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div>
            <Button onClick={create} size="sm">Raise Alert</Button>
            <p className="text-xs text-muted-foreground">Creates IN_APP notifications for all members and audit log. No SMS.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0 divide-y">
            {items.map((a:any)=>(
              <div key={a.id} className="flex justify-between p-3">
                <div><p className="text-sm font-medium">{a.type} <Badge variant={a.status==="OPEN"?"destructive":"secondary"}>{a.status}</Badge></p><p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p></div>
                <div className="flex gap-1">
                  {a.status==="OPEN" && <><Button size="sm" variant="outline" onClick={()=>resolve(a.id,"ACKNOWLEDGED")}>Acknowledge</Button><Button size="sm" onClick={()=>resolve(a.id,"RESOLVED")}>Resolve</Button></>}
                  {a.status!=="OPEN" && <Badge variant="outline">Handled</Badge>}
                </div>
              </div>
            ))}
            {items.length===0 && <p className="text-sm text-muted-foreground text-center py-8">No alerts</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
