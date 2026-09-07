"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Megaphone, Clock, AlertTriangle } from "lucide-react";
export default function AnnouncementsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  useEffect(()=>{ fetch("/api/announcements").then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>setItems(Array.isArray(d)?d:[])).catch(()=>setError("Failed to load")).finally(()=>setLoading(false)); },[]);
  if (loading) return <AppShell><div className="max-w-4xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if (error) return <AppShell><div className="max-w-4xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p></CardContent></Card></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Announcements" description="Society updates • newest first" />
        {items.length===0 ? <EmptyState icon={<Megaphone className="h-5 w-5" />} title="No announcements yet" description="Society admin publishes updates here. You'll be notified when new announcements arrive." /> : (
          <div className="space-y-3">
            {items.map((a:any)=>(
              <Link key={a.id} href={`/announcements/${a.id}`}>
                <Card className={`hover:bg-muted/30 ${a.priority==="HIGH"||a.priority==="IMPORTANT" ? "border-l-4 border-l-amber-500 bg-amber-50/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold flex items-center gap-2 truncate">{a.priority==="HIGH" && <AlertTriangle className="h-4 w-4 text-amber-600" />}{a.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.body}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2"><Clock className="h-3 w-3" />{new Date(a.publishedAt||a.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant={a.priority==="HIGH"?"destructive": a.priority==="IMPORTANT"?"default":"secondary"} className="shrink-0 h-6">{a.priority}</Badge>
                    </div>
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
