"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, ShieldCheck, Clock, Trash2, MapPin } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function HelpDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch(`/api/help/${params.id}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(setData).catch(()=>{}).finally(()=>setLoading(false));
    fetch("/api/help/attendance").then(r=>r.json()).then(d=> setAttendance(Array.isArray(d)? d.filter((a:any)=>a.help?.id===params.id) : [])).catch(()=>{});
  }, [params.id]);

  async function remove(){
    const res = await fetch(`/api/help/${params.id}`, { method:"DELETE" });
    if (res.ok){ toast.success("Removed"); router.push("/help"); } else { const j=await res.json(); toast.error(j.error||"Failed"); }
  }

  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (!data) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center">Not found</CardContent></Card></div></AppShell>;

  const { help, links } = data;
  const inside = attendance.some((a:any)=>!a.attendance.checkOut);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/help")}>← Domestic Help</Button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg">{help.name[0]}</div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold">{help.name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{help.phone} • {help.category}</p>
                <div className="mt-2 flex gap-2">
                  <Badge variant={help.policeVerified ? "default" : "outline"} className={help.policeVerified ? "bg-emerald-600" : ""}>{help.policeVerified ? "Police verified" : "Unverified"}</Badge>
                  <Badge variant={inside ? "default" : "secondary"} className={inside ? "bg-emerald-600" : ""}>{inside ? "Inside" : "Not inside"}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Linked units</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {links.length===0 ? <p className="text-sm text-muted-foreground">No links</p> : links.map((l:any)=>(
              <div key={l.id} className="flex justify-between rounded-lg border px-3 py-2">
                <span className="text-sm flex items-center gap-1"><MapPin className="h-3 w-3" />{l.unitId.slice(0,8)}</span>
                <span className="text-xs text-muted-foreground">{l.isActive ? "Active" : "Inactive"}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Guard checks attendance per unit. Schedule support ready for future.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-3 w-3" />Recent attendance</CardTitle></CardHeader>
          <CardContent>
            {attendance.length===0 ? <p className="text-sm text-muted-foreground">No check-ins yet</p> : (
              <ul className="space-y-2">
                {attendance.slice(0,5).map((a:any)=>(
                  <li key={a.attendance.id} className="flex justify-between rounded-lg border px-3 py-2">
                    <div><p className="text-sm">{new Date(a.attendance.checkIn).toLocaleString()}</p><p className="text-xs text-muted-foreground">Unit {a.unit?.number || a.attendance.unitId.slice(0,8)} • Gate {a.attendance.gateId?.slice(0,8) || "—"}</p></div>
                    <span className="text-xs">{a.attendance.checkOut ? `Out ${new Date(a.attendance.checkOut).toLocaleTimeString()}` : "Inside"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="w-full"><Trash2 className="h-4 w-4 mr-2" />Remove Help</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Remove?</AlertDialogTitle><AlertDialogDescription>Removes all links and help record. Attendance history remains.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Remove</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
