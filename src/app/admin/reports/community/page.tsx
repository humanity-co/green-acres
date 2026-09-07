"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, BarChart3, Calendar, Siren, Bell } from "lucide-react";
export default function CommunityReport(){
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ fetch("/api/admin/reports/community").then(r=>r.json()).then(setData).finally(()=>setLoading(false)); },[]);
  if(loading) return <AppShell><div className="max-w-6xl mx-auto"><div className="h-32 bg-muted animate-pulse rounded-xl"/></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Community Report" description="Announcements, polls, events, emergencies" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Announcements" value={data.announcements} icon={<Megaphone className="h-4 w-4"/>} />
          <StatCard label="Polls" value={data.polls} icon={<BarChart3 className="h-4 w-4"/>} sub={`${data.pollParticipation} votes`} />
          <StatCard label="Events" value={data.events} icon={<Calendar className="h-4 w-4"/>} />
          <StatCard label="Emergencies" value={data.emergencies} icon={<Siren className="h-4 w-4"/>} />
          <StatCard label="Notifications" value={data.notifications} icon={<Bell className="h-4 w-4"/>} />
        </div>
        <Card><CardContent className="p-3 text-xs text-muted-foreground">{data.note}</CardContent></Card>
      </div>
    </AppShell>
  );
}
