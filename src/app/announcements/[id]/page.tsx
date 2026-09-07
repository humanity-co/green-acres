"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Clock } from "lucide-react";
export default function AnnouncementDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  useEffect(()=>{ fetch(`/api/announcements/${params.id}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(setItem).catch(()=>setError("Not found")).finally(()=>setLoading(false)); },[params.id]);
  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (error || !item) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>router.push("/announcements")}>Back</Button></CardContent></Card></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/announcements")}>← Announcements</Button>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" />{item.title}</CardTitle><div className="flex gap-2"><Badge>{item.priority}</Badge><Badge variant="outline">{item.audienceScope}</Badge></div></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.body}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(item.publishedAt||item.createdAt).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
