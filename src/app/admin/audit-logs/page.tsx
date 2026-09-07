"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { ScrollText, Download, Search } from "lucide-react";
export default function AuditLogsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [action,setAction]=useState("all");
  const [entity,setEntity]=useState("all");
  const [limit,setLimit]=useState("50");
  const load=async()=>{
    setLoading(true);
    const params=new URLSearchParams();
    if(action!=="all") params.set("action",action);
    if(entity!=="all") params.set("entity",entity);
    params.set("limit",limit);
    const r=await fetch(`/api/admin/audit-logs?${params}`);
    const d=await r.json();
    setItems(Array.isArray(d)?d:[]);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[limit]);
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Audit Logs" description="Append-only • newest first • admin only" action={<Button size="sm" variant="outline" onClick={()=>window.location.href="/api/admin/export/audit"}><Download className="h-4 w-4 mr-1"/>CSV</Button>} />
        <Card><CardContent className="p-3 flex flex-wrap gap-2">
          <Select value={action} onValueChange={setAction}><SelectTrigger className="w-36"><SelectValue placeholder="Action" /></SelectTrigger><SelectContent><SelectItem value="all">All actions</SelectItem><SelectItem value="create">create</SelectItem><SelectItem value="update">update</SelectItem><SelectItem value="delete">delete</SelectItem><SelectItem value="vote">vote</SelectItem></SelectContent></Select>
          <Select value={entity} onValueChange={setEntity}><SelectTrigger className="w-36"><SelectValue placeholder="Entity" /></SelectTrigger><SelectContent><SelectItem value="all">All entities</SelectItem><SelectItem value="announcement">announcement</SelectItem><SelectItem value="poll">poll</SelectItem><SelectItem value="event">event</SelectItem><SelectItem value="bill">bill</SelectItem><SelectItem value="payment">payment</SelectItem></SelectContent></Select>
          <Select value={limit} onValueChange={setLimit}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
          <Button size="sm" onClick={load}><Search className="h-4 w-4 mr-1"/>Filter</Button>
        </CardContent></Card>
        {loading ? <LoadingSkeleton rows={5}/> : items.length===0 ? <EmptyState icon={<ScrollText className="h-5 w-5"/>} title="No audit logs" description="No entries match filter." /> : (
          <Card><CardContent className="p-0 divide-y">
            {items.map((a:any)=>(
              <div key={a.id} className="p-3">
                <div className="flex flex-wrap gap-2 items-center"><Badge variant="outline">{a.action}</Badge><Badge>{a.entity}</Badge><span className="text-xs text-muted-foreground">{a.actorId?.slice(0,8) || "system"} • {new Date(a.createdAt).toLocaleString()}</span></div>
                <p className="text-xs font-mono mt-1 truncate">{a.entityId?.slice(0,8) || ""}</p>
                {(a.prevState || a.newState) && <div className="mt-1 grid sm:grid-cols-2 gap-2 text-xs"><div><p className="font-semibold">Prev</p><p className="truncate bg-muted p-1 rounded">{a.prevState || "—"}</p></div><div><p className="font-semibold">New</p><p className="truncate bg-muted p-1 rounded">{a.newState || "—"}</p></div></div>}
              </div>
            ))}
          </CardContent></Card>
        )}
        <p className="text-xs text-muted-foreground">Read-only. UPDATE/DELETE revoked for app_user. No raw SQL.</p>
      </div>
    </AppShell>
  );
}
