"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, Trash2, Edit2 } from "lucide-react";
export default function AdminEvents() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title:"", description:"", startsAt:"", endsAt:"", location:"" });
  const [editing, setEditing] = useState<any>(null);
  const load = async()=>{ const r=await fetch("/api/events"); const d=await r.json(); setItems(Array.isArray(d)?d:[]); };
  useEffect(()=>{ load(); },[]);
  const submit = async()=>{
    if(!form.title || !form.startsAt) return toast.error("Title and startsAt required");
    const url = editing ? `/api/events/${editing.id}` : "/api/events";
    const method = editing ? "PATCH" : "POST";
    const payload:any = { title: form.title, description: form.description, startsAt: new Date(form.startsAt).toISOString(), location: form.location };
    if(form.endsAt) payload.endsAt = new Date(form.endsAt).toISOString();
    const r=await fetch(url,{ method, headers:{ "Content-Type":"application/json"}, body: JSON.stringify(payload)});
    if(!r.ok){ const d=await r.json(); return toast.error(d.error||"Failed"); }
    toast.success(editing?"Updated":"Created"); setForm({ title:"", description:"", startsAt:"", endsAt:"", location:""}); setEditing(null); load();
  };
  const remove = async(id:string)=>{
    if(!confirm("Delete?")) return;
    const r=await fetch(`/api/events/${id}`,{ method:"DELETE"});
    if(!r.ok) return toast.error("Failed");
    toast.success("Deleted"); load();
  };
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Events — Admin" description="Create and manage community events" />
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />{editing?"Edit":"Create"} Event</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} rows={3} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Starts At *</Label><Input type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form, startsAt:e.target.value})} /></div>
              <div className="space-y-1"><Label>Ends At</Label><Input type="datetime-local" value={form.endsAt} onChange={e=>setForm({...form, endsAt:e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={e=>setForm({...form, location:e.target.value})} placeholder="Clubhouse" /></div>
            <div className="flex gap-2"><Button onClick={submit} size="sm">{editing?"Update":"Create"}</Button>{editing && <Button variant="outline" size="sm" onClick={()=>{setEditing(null); setForm({title:"",description:"",startsAt:"",endsAt:"",location:""})}}>Cancel</Button>}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0 divide-y">
            {items.map((e:any)=>(
              <div key={e.id} className="flex justify-between p-3">
                <div><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{new Date(e.startsAt).toLocaleString()} • {e.location || "—"}</p></div>
                <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={()=>{ setEditing(e); setForm({ title:e.title, description:e.description||"", startsAt: e.startsAt? new Date(e.startsAt).toISOString().slice(0,16):"", endsAt: e.endsAt? new Date(e.endsAt).toISOString().slice(0,16):"", location:e.location||""}); }} aria-label="Edit"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={()=>remove(e.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
            {items.length===0 && <p className="text-sm text-muted-foreground text-center py-8">No events</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
