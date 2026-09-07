"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Users } from "lucide-react";
export default function AdminVisitors(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ fetch("/api/visitors").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>setItems(Array.isArray(d)?d:[])).catch(()=>setError("Failed to load visitors")).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if(error) return <AppShell><div className="max-w-6xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Visitors — Admin" description="Visitor invites • society-scoped" />
        <Card><CardContent className="p-0 divide-y">
          {items.slice(0,20).map((v:any)=>(
            <div key={v.id} className="p-3 flex items-start">
              <div className="w-8 rounded-md bg-border flex-shrink-0">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground truncate">{v.phone}</p>
              </div>
              <div className="mt-2 text-right">
                <StatusBadge status={v.govIdType||"visit"} />
              </div>
            </div>
          ))}
          {items.length===0 && (
            <div className="py-10">
              <EmptyState icon={<Users className="h-5 w-5"/>} title="No visitors" description="Invites appear here." />
            </div>
          )}
        </CardContent></Card>
      </div>
    </AppShell>
  );
}