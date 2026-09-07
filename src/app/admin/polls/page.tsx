"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BarChart3, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
export default function AdminPolls() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ question:"", options:["",""], endsAt:"" });
  const load = async()=>{ const r=await fetch("/api/polls"); const d=await r.json(); setItems(Array.isArray(d)?d:[]); };
  useEffect(()=>{ load(); },[]);
  const addOpt = ()=> setForm({...form, options:[...form.options,""]});
  const submit = async()=>{
    if(!form.question || form.options.filter(o=>o.trim()).length<2) return toast.error("Question and 2 options required");
    const r=await fetch("/api/polls",{ method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ question:form.question, options:form.options.filter(o=>o.trim()), endsAt: form.endsAt || undefined })});
    if(!r.ok){ const d=await r.json(); return toast.error(d.error||"Failed"); }
    toast.success("Poll created"); setForm({ question:"", options:["",""], endsAt:""}); load();
  };
  const closePoll = async(id:string)=>{
    const r=await fetch(`/api/polls/${id}`,{ method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ endsAt: new Date().toISOString() })});
    if(!r.ok) return toast.error("Failed"); toast.success("Closed"); load();
  };
  const remove = async(id:string)=>{
    if(!confirm("Delete poll?")) return;
    const r=await fetch(`/api/polls/${id}`,{ method:"DELETE"});
    const d=await r.json();
    if(!r.ok) return toast.error(d.error||"Failed");
    toast.success("Deleted"); load();
  };
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Polls — Admin" description="Create and manage community polls" />
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Create Poll</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Question *</Label><Input value={form.question} onChange={e=>setForm({...form, question:e.target.value})} placeholder="Should we install EV charging?" /></div>
            {form.options.map((o,i)=>(
              <div key={i} className="space-y-1"><Label>Option {i+1}</Label><Input value={o} onChange={e=>{ const a=[...form.options]; a[i]=e.target.value; setForm({...form, options:a}); }} placeholder={`Option ${i+1}`} /></div>
            ))}
            <Button variant="outline" size="sm" onClick={addOpt}>Add option</Button>
            <div className="space-y-1"><Label>Ends At (optional)</Label><Input type="datetime-local" value={form.endsAt} onChange={e=>setForm({...form, endsAt:e.target.value})} /></div>
            <Button onClick={submit} size="sm">Create Poll</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0 divide-y">
            {items.map(({ poll, options, totalVotes, isClosed }:any)=>(
              <div key={poll.id} className="p-3 flex justify-between">
                <div><p className="text-sm font-medium">{poll.question}</p><p className="text-xs text-muted-foreground">{options.map((o:any)=>o.label).join(" • ")} • {totalVotes} votes</p><Badge variant={isClosed?"secondary":"default"} className="mt-1">{isClosed?"Closed":"Open"}</Badge></div>
                <div className="flex gap-1"><Button variant="outline" size="sm" onClick={()=>closePoll(poll.id)} disabled={isClosed}>Close</Button><Button variant="ghost" size="icon" onClick={()=>remove(poll.id)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
            {items.length===0 && <p className="text-sm text-muted-foreground text-center py-8">No polls</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
