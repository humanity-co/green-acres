"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Shield, Users, LogIn } from "lucide-react";
export default function AdminGates() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/gates").then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false)); }, []);
  if (loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={3} /></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Gates" description="Gate infrastructure and live traffic" />
        {items.length === 0 ? <EmptyState icon={<Shield className="h-5 w-5" />} title="No gates" description="Gates appear here." /> : (
          <div className="grid md:grid-cols-2 gap-3">
            {items.map((it: any) => (
              <Card key={it.gate.id} className="hover:bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex justify-between"><p className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4" />{it.gate.name} <Badge variant="outline">{it.gate.type}</Badge></p><Badge variant={it.inside > 0 ? "default" : "secondary"}>{it.inside} inside</Badge></div>
                  <p className="text-xs text-muted-foreground mt-1">Total entries: {it.total} • Society-scoped</p>
                  <p className="text-xs text-muted-foreground">Guard assignment not in schema — traffic only.</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
