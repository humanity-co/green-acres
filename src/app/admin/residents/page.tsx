"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Users, Search, Download } from "lucide-react";
export default function AdminResidents() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const r = await fetch(`/api/admin/residents?limit=50&q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setItems(Array.isArray(d) ? d : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const exportCsv = () => { window.location.href = "/api/admin/export/residents"; };
  if (loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={5} /></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Residents" description="Society members • society-scoped" action={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>} />
        <Card><CardContent className="p-3 flex gap-2"><Input placeholder="Search name, phone, unit" value={q} onChange={e => setQ(e.target.value)} className="flex-1" /><Button onClick={load}><Search className="h-4 w-4 mr-1" />Search</Button></CardContent></Card>
        {items.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} title="No residents" description="No members match the filter." /> : (
          <Card><CardContent className="p-0 divide-y">
            {items.slice(0, 50).map((it: any) => (
              <div key={it.member.id} className="flex justify-between p-3 hover:bg-muted/20">
                <div><p className="text-sm font-medium">{it.user.fullName} <Badge variant="outline" className="ml-1">{it.member.relation}</Badge> {it.member.isPrimary && <Badge>Primary</Badge>}</p><p className="text-xs text-muted-foreground">{it.user.phone} • {it.unit.number} • {it.building?.name || ""} F{it.floor?.number ?? ""}</p></div>
                <Badge variant="secondary">{it.member.isVerified ? "Verified" : "Pending"}</Badge>
              </div>
            ))}
          </CardContent></Card>
        )}
        <p className="text-xs text-muted-foreground">PII limited to admin operations. No auth secrets. Role mutation read-only in MVP.</p>
      </div>
    </AppShell>
  );
}
