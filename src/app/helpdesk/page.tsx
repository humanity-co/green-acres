"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { ListCard } from "@/components/shared/ListCard";
import { Wrench, Plus } from "lucide-react";
export default function HelpdeskPage(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("all");
  const load=async()=>{
    const r=await fetch("/api/helpdesk");
    const d=await r.json();
    setItems(Array.isArray(d)?d:[]);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);
  const filtered = tab==="all" ? items : items.filter((t:any)=>t.status===tab.toUpperCase());
  if(loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4}/></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Helpdesk" description="Complaints and service requests • your tickets" action={<Link href="/helpdesk/new"><Button size="sm"><Plus className="h-4 w-4 mr-1"/>New Ticket</Button></Link>} />
        <Tabs value={tab} onValueChange={setTab}><TabsList className="flex w-full overflow-x-auto gap-1 h-10 p-1 justify-start"><TabsTrigger value="all" className="text-xs whitespace-nowrap shrink-0">All ({items.length})</TabsTrigger><TabsTrigger value="open" className="text-xs whitespace-nowrap shrink-0">Open</TabsTrigger><TabsTrigger value="assigned" className="text-xs whitespace-nowrap shrink-0">Assigned</TabsTrigger><TabsTrigger value="resolved" className="text-xs whitespace-nowrap shrink-0">Resolved</TabsTrigger><TabsTrigger value="closed" className="text-xs whitespace-nowrap shrink-0">Closed</TabsTrigger></TabsList></Tabs>
        {filtered.length===0 ? <EmptyState icon={<Wrench className="h-5 w-5"/>} title="No tickets" description={tab==="all" ? "Create a complaint to get help." : `No ${tab} tickets.`} href={tab==="all" ? "/helpdesk/new" : undefined} /> : (
          <div className="space-y-3">
            {filtered.map((t:any)=>(
              <ListCard
                key={t.id}
                href={`/helpdesk/${t.id}`}
                title={t.title}
                subtitle={`${t.unit?.number ? `Unit ${t.unit.number} • ` : ""}${t.category} • ${t.priority}`}
                meta={new Date(t.createdAt).toLocaleString()}
                status={t.status}
                categoryBadge={t.category}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
