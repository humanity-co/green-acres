"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { HeartHandshake, Phone, Clock, ShieldCheck, Plus } from "lucide-react";

export default function HelpPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(()=>{
    Promise.all([
      fetch("/api/help").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }),
      fetch("/api/help/attendance").then(r=>r.json()).catch(()=>[]),
    ]).then(([h, a])=>{ setItems(Array.isArray(h)? h: []); setAttendance(Array.isArray(a)? a: []); }).catch(()=>setError("Couldn't load help")).finally(()=>setLoading(false));
  }, []);

  const inside = attendance.filter(a=>!a.attendance.checkOut);

  if (loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if (error) return <AppShell><div className="max-w-4xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>location.reload()}>Retry</Button></CardContent></Card></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Domestic Help" description="Maids, cooks, drivers linked to your home • Guard tracks entry" action={<Link href="/help/new"><Button><Plus className="h-4 w-4 mr-2" />Add Help</Button></Link>} />

        {inside.length>0 && (
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-emerald-700" /><div><p className="text-sm font-semibold">{inside.length} Currently inside</p><p className="text-xs text-muted-foreground">{inside.map((i:any)=>i.help?.name).join(", ")}</p></div></div>
              <Badge className="bg-emerald-600">INSIDE</Badge>
            </CardContent>
          </Card>
        )}

        {items.length===0 ? (
          <EmptyState icon={<HeartHandshake className="h-5 w-5" />} title="No domestic help yet" description="Add your maid, cook or driver to generate a pass for gate entry." actionLabel="Add Help" onAction={()=>location.href="/help/new"} />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {items.map(({help, links}:any)=>(
              <Link key={help.id} href={`/help/${help.id}`}>
                <Card className="hover:bg-muted/30 h-full">
                  <CardContent className="p-4">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{help.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{help.phone} • {help.category}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />Links: {links.length} unit(s)</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={help.policeVerified ? "default" : "outline"} className={help.policeVerified ? "bg-emerald-600" : ""}>{help.policeVerified ? "Verified" : "Unverified"}</Badge>
                        <span className="text-xs text-muted-foreground">{inside.some((a:any)=>a.help?.id===help.id) ? "Inside" : "Not inside"}</span>
                      </div>
                    </div>
                    {help.policeVerified && <p className="text-xs flex items-center gap-1 text-emerald-600 mt-2"><ShieldCheck className="h-3 w-3" />Police verified</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
