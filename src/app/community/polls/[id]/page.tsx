"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
export default function PollDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = async()=>{ const r=await fetch(`/api/polls/${params.id}`); if(!r.ok) throw new Error(); setData(await r.json()); };
  useEffect(()=>{ load().finally(()=>setLoading(false)); },[params.id]);
  const vote = async(optionId:string)=>{
    const r=await fetch(`/api/polls/${params.id}/vote`,{ method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ optionId })});
    const d=await r.json();
    if(!r.ok) return toast.error(d.error||"Failed");
    toast.success("Vote recorded"); load();
  };
  if (loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if (!data) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center">Not found</CardContent></Card></div></AppShell>;
  const { poll, options, totalVotes, userVoteOptionId, isClosed } = data;
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/community/polls")}>← Polls</Button>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-5 w-5" />{poll.question}</CardTitle><div className="flex gap-2"><Badge variant={isClosed?"secondary":"default"}>{isClosed?"Closed":"Open"}</Badge>{poll.endsAt && <Badge variant="outline">Ends {new Date(poll.endsAt).toLocaleString()}</Badge>}</div></CardHeader>
          <CardContent className="space-y-2">
            {options.map((o:any)=>(
              <div key={o.id} className={`flex justify-between items-center rounded-xl border p-3 ${userVoteOptionId===o.id?"bg-primary text-primary-foreground":"hover:bg-muted/30"}`}>
                <span className="text-sm font-medium">{o.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs">{o.voteCount} votes ({totalVotes?Math.round(o.voteCount/totalVotes*100):0}%)</span>
                  {!isClosed && !userVoteOptionId && <Button size="sm" variant={userVoteOptionId===o.id?"secondary":"default"} onClick={()=>vote(o.id)}>Vote</Button>}
                  {userVoteOptionId===o.id && <Badge>You</Badge>}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{totalVotes} total votes • {isClosed ? "Voting closed" : userVoteOptionId ? "You voted" : "Vote exactly once"}</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
