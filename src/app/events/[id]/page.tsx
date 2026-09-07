"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock } from "lucide-react";
export default function EventDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ fetch(`/api/events/${params.id}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(setItem).catch(()=>{}).finally(()=>setLoading(false)); },[params.id]);
  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (!item) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center">Not found <Button variant="outline" className="mt-3" onClick={()=>router.push("/events")}>Back</Button></CardContent></Card></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/events")}>← Events</Button>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />{item.title}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{item.description || "No description"}</p>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{new Date(item.startsAt).toLocaleString()} {item.endsAt && `→ ${new Date(item.endsAt).toLocaleString()}`}</p>
              {item.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{item.location}</p>}
            </div>
            <Badge>{new Date(item.startsAt) >= new Date() ? "Upcoming" : "Past"}</Badge>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
