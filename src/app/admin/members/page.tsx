"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Users } from "lucide-react";
export default function AdminMembers(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ fetch("/api/admin/members").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>setItems(Array.isArray(d)?d:[])).catch(()=>setError("Failed to load members")).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if(error) return <AppShell><div className="max-w-6xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Members & Roles" description="Read-only role assignments • tenant-scoped" />
        <Card><CardContent className="p-0 divide-y">
          {items.slice(0,50).map((m:any, i:number)=>(
            <div key={i} className="flex justify-between p-3">
              <div>
                <p className="text-sm font-medium">{m.user?.fullName || "Unknown"} • {m.user?.phone}</p>
                <p className="text-xs text-muted-foreground">{m.user?.id.slice(0,8)}</p>
              </div>
              <Badge>{m.role}</Badge>
            </div>
          ))}
          {items.length===0 && (
            <div className="py-10">
              <EmptyState icon={<Users className="h-5 w-5"/>} title="No members" description="Members appear here." />
            </div>
          )}
        </CardContent></Card>
        <p className="text-xs text-muted-foreground">Role mutation is deferred in MVP — read-only. Prevents self-escalation and SUPER_ADMIN assignment. Use secure migration for changes.</p>
      </div>
    </AppShell>
  );
}