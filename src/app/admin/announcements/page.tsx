"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, Trash2, Edit2 } from "lucide-react";
export default function AdminAnnouncements() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title:"", body:"", priority:"NORMAL" });
  const [editing, setEditing] = useState<any>(null);
  const load = async()=>{ const r=await fetch("/api/announcements"); const d=await r.json(); setItems(Array.isArray(d)?d:[]); };
  useEffect(()=>{ load(); },[]);
  const submit = async()=>{
    if(!form.title||!form.body) return toast.error("Title and body required");
    const url = editing ? `/api/announcements/${editing.id}` : "/api/announcements";
    const method = editing ? "PATCH" : "POST";
    const r=await fetch(url,{ method, headers:{ "Content-Type":"application/json"}, body: JSON.stringify(form)});
    if(!r.ok){ const d=await r.json(); return toast.error(d.error||"Failed"); }
    toast.success(editing? "Updated":"Created");
    setForm({ title:"", body:"", priority:"NORMAL"}); setEditing(null); load();
  };
  const remove = async(id:string)=>{
    if(!confirm("Delete?")) return;
    const r=await fetch(`/api/announcements/${id}`,{ method:"DELETE"});
    if(!r.ok) return toast.error("Failed");
    toast.success("Deleted"); load();
  };
  const startEdit=(a:any)=>{ setEditing(a); setForm({ title:a.title, body:a.body, priority:a.priority}); };
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Announcements — Admin" description="Create and manage society announcements" />
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4" />{editing?"Edit":"Create"} Announcement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Water supply maintenance" maxLength={200} /></div>
            <div className="space-y-1"><Label>Body *</Label><Textarea value={form.body} onChange={e=>setForm({...form, body:e.target.value})} placeholder="Details..." rows={4} maxLength={5000} /></div>
            <div className="space-y-1"><Label>Priority</Label><Select value={form.priority} onValueChange={v=>setForm({...form, priority:v})}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="IMPORTANT">Important</SelectItem></SelectContent></Select></div>
            <div className="flex gap-2"><Button onClick={submit} size="sm">{editing?"Update":"Create"}</Button>{editing && <Button variant="outline" size="sm" onClick={()=>{setEditing(null); setForm({title:"",body:"",priority:"NORMAL"})}}>Cancel</Button>}</div>
            {form.title && <Card className="bg-muted/30"><CardContent className="p-3"><p className="text-xs font-semibold">Preview</p><p className="text-sm font-medium">{form.title}</p><p className="text-xs text-muted-foreground">{form.body}</p></CardContent></Card>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0 divide-y">
            {items.map((a:any)=>(
              <div key={a.id} className="flex justify-between p-3 hover:bg-muted/20">
                <div className="min-w-0"><p className="text-sm font-medium truncate">{a.title}</p><p className="text-xs text-muted-foreground line-clamp-1">{a.body}</p><p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()} <Badge variant="outline" className="ml-1">{a.priority}</Badge></p></div>
                <div className="flex gap-1 shrink-0"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>startEdit(a)} aria-label="Edit"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={()=>remove(a.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
            {items.length===0 && <p className="text-sm text-muted-foreground text-center py-8">No announcements</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
