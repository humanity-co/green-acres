"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Copy, Share2, Clock, Phone, Calendar, MapPin, Shield } from "lucide-react";

export default function VisitorDetailPage() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{
    fetch(`/api/invites/${params.id}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(setData).catch(()=>setError("Couldn't load visitor")).finally(()=>setLoading(false));
  }, [params.id]);

  async function cancel(){
    const res = await fetch(`/api/invites/${params.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status:"CANCELLED"}) });
    if (res.ok){ toast.success("Invitation cancelled"); setData((d:any)=>({...d, invite:{...d.invite, status:"CANCELLED"}})); }
    else { const j=await res.json(); toast.error(j.error || "Failed to cancel"); }
  }

  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse space-y-4"><div className="h-32 bg-muted rounded-xl" /><div className="h-40 bg-muted rounded-xl" /></div></AppShell>;
  if (error || !data) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error || "Not found"}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>router.push("/visitors")}>Back to visitors</Button></CardContent></Card></div></AppShell>;

  const { invite, visitor, unit, entries } = data;
  const entry = entries?.[0];
  const isCancelled = invite.status==="CANCELLED";
  const isExpired = new Date(invite.validTo) < new Date();
  const canCancel = !isCancelled && !isExpired && !entry?.checkIn;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={()=>router.push("/visitors")}>← Visitors</Button>
          <Badge variant="outline" className="ml-auto">{invite.code}</Badge>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium">{visitor.name[0]}</div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold">{visitor.name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{visitor.phone}</p>
                <p className="text-sm mt-1">{invite.purpose}</p>
              </div>
              <StatusBadge status={entry?.checkOut ? "CHECKED_OUT" : entry ? "CHECKED_IN" : invite.status} />
            </div>

            <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">Gate pass code</p>
              <p className="text-3xl font-mono font-bold tracking-widest mt-1">{invite.code}</p>
              <p className="text-xs text-muted-foreground mt-1">{invite.status==="PENDING" ? "Show at gate • Valid for one entry" : invite.status}</p>
              <div className="flex gap-2 mt-3 justify-center">
                <Button size="sm" variant="outline" onClick={async()=>{ await navigator.clipboard.writeText(invite.code); toast.success("Copied"); }}><Copy className="h-4 w-4 mr-1" />Copy</Button>
                <Button size="sm" variant="outline" onClick={async()=>{
                  if (navigator.share) await navigator.share({ title:`Pass ${invite.code}`, text:`Visitor ${visitor.name} • ${invite.code}` });
                  else { await navigator.clipboard.writeText(`Pass ${invite.code} for ${visitor.name}`); toast.success("Copied"); }
                }}><Share2 className="h-4 w-4 mr-1" />Share</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Visit details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Valid from</span><span className="font-medium">{new Date(invite.validFrom).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Valid until</span><span className="font-medium">{new Date(invite.validTo).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Unit</span><span className="font-medium">{unit?.number || invite.unitId.slice(0,8)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" />Invite status</span><StatusBadge status={invite.status} /></div>
            {entry && <>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Checked in</span><span className="font-medium">{new Date(entry.checkIn).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Checked out</span><span className="font-medium">{entry.checkOut ? new Date(entry.checkOut).toLocaleString() : "— Inside"}</span></div>
            </>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative border-l pl-4 space-y-4">
              <li><div className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary mt-1" /><p className="text-sm font-medium">Invitation created</p><p className="text-xs text-muted-foreground">{new Date(invite.createdAt).toLocaleString()} • by you</p></li>
              <li><div className={`absolute -left-1.5 h-3 w-3 rounded-full mt-1 ${invite.status==="CANCELLED" ? "bg-red-500" : "bg-muted"}`} /><p className="text-sm font-medium">{invite.status}</p><p className="text-xs text-muted-foreground">Current status</p></li>
              {entry && <li><div className="absolute -left-1.5 h-3 w-3 rounded-full bg-emerald-500 mt-1" /><p className="text-sm font-medium">Checked in</p><p className="text-xs text-muted-foreground">{new Date(entry.checkIn).toLocaleString()} • Gate</p></li>}
              {entry?.checkOut && <li><div className="absolute -left-1.5 h-3 w-3 rounded-full bg-muted-foreground mt-1" /><p className="text-sm font-medium">Checked out</p><p className="text-xs text-muted-foreground">{new Date(entry.checkOut).toLocaleString()}</p></li>}
            </ol>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          {canCancel ? (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" className="flex-1">Cancel invitation</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Cancel invitation?</AlertDialogTitle><AlertDialogDescription>This will invalidate the pass {invite.code}. The visitor will be denied entry. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Keep invitation</AlertDialogCancel><AlertDialogAction onClick={cancel}>Yes, cancel</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <Button variant="outline" className="flex-1" disabled>{isCancelled ? "Cancelled" : isExpired ? "Expired" : entry ? "Already checked in" : "Cannot cancel"}</Button>}
          <Button className="flex-1" onClick={()=>router.push("/visitors")}>Done</Button>
        </div>
      </div>
    </AppShell>
  );
}
