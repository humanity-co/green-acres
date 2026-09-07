"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Calendar, MapPin, Clock } from "lucide-react";
export default function EventsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  useEffect(()=>{ fetch("/api/events").then(r=>r.json()).then(d=>setItems(Array.isArray(d)?d:[])).finally(()=>setLoading(false)); },[]);
  const now = new Date();
  const upcoming = useMemo(()=> items.filter(e=> new Date(e.startsAt) >= now), [items]);
  const past = useMemo(()=> items.filter(e=> new Date(e.startsAt) < now), [items]);
  const list = tab==="upcoming" ? upcoming : past;
  if (loading) return <AppShell><div className="max-w-3xl mx-auto"><LoadingSkeleton rows={3} /></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Events" description="Community gatherings • upcoming and past" />
        <Tabs value={tab} onValueChange={setTab}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger><TabsTrigger value="past">Past ({past.length})</TabsTrigger></TabsList></Tabs>
        {list.length===0 ? <EmptyState icon={<Calendar className="h-5 w-5" />} title={tab==="upcoming"?"No upcoming events":"No past events"} description={tab==="upcoming" ? "No upcoming events — society admin publishes community gatherings here. Check back soon." : "No past events — completed gatherings will appear here."} /> : (
          <div className="space-y-3">
            {list.map((e:any)=>(
              <Link key={e.id} href={`/events/${e.id}`}>
                <Card className="hover:bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{e.description || "No description"}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(e.startsAt).toLocaleString()}</span>
                      {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                    </div>
                    <Badge variant={new Date(e.startsAt)>=now?"default":"secondary"} className="mt-2">{new Date(e.startsAt)>=now?"Upcoming":"Past"}</Badge>
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
