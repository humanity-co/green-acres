"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { BarChart3, Clock } from "lucide-react";
export default function PollsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ fetch("/api/polls").then(r=>r.json()).then(d=>setItems(Array.isArray(d)?d:[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <AppShell><div className="max-w-3xl mx-auto"><LoadingSkeleton rows={3} /></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Polls" description="Community decisions • vote once" />
        {items.length===0 ? <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No polls" description="Active polls appear here." /> : (
          <div className="space-y-3">
            {items.map(({ poll, options, totalVotes, userVoteOptionId, isClosed }: any)=>(
              <Link key={poll.id} href={`/community/polls/${poll.id}`}>
                <Card className={`hover:bg-muted/30 ${isClosed ? "opacity-60" : "border-l-4 border-l-primary"}`}>
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold">{poll.question}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{poll.endsAt ? `Ends ${new Date(poll.endsAt).toLocaleString()}` : "No deadline"} • {totalVotes} votes</p>
                    <div className="mt-2 space-y-1">
                      {options.slice(0,3).map((o:any)=>(
                        <div key={o.id} className="flex justify-between text-xs"><span>{o.label}</span><span className="text-muted-foreground">{o.voteCount} ({totalVotes? Math.round(o.voteCount/totalVotes*100):0}%) {userVoteOptionId===o.id && "• You"}</span></div>
                      ))}
                    </div>
                    <div className="mt-2"><Badge variant={isClosed?"secondary": userVoteOptionId?"default":"outline"}>{isClosed?"Closed": userVoteOptionId?"Voted":"Open"}</Badge></div>
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
