"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/shared/EmptyState";
import { EmergencyModal } from "@/components/shared/EmergencyModal";
import { Siren, Clock, PhoneCall, AlertTriangle, ShieldCheck } from "lucide-react";

export default function EmergencyPage() {
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  function loadAlerts() {
    fetch("/api/emergency")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/emergency").then((r) => r.json()).catch(() => []),
      fetch("/api/units").then((r) => r.json()).catch(() => []),
    ])
      .then(([alertsData, unitsData]) => {
        setItems(Array.isArray(alertsData) ? alertsData : []);
        setUnits(Array.isArray(unitsData) ? unitsData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const active = items.filter((a) => a.status === "OPEN");
  const resolved = items.filter((a) => a.status !== "OPEN");

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-4">
          <LoadingSkeleton rows={3} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Emergency Protocol & Alerts"
          description="Instant community broadcast and urgent response coordination"
          action={
            <Button
              onClick={() => setModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
            >
              <AlertTriangle className="h-4 w-4 mr-2" /> Raise Emergency Alert
            </Button>
          }
        />

        {active.length === 0 ? (
          <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20">
            <CardContent className="p-5 text-center space-y-1">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                All Clear — No Active Emergencies
              </p>
              <p className="text-xs text-muted-foreground">
                Estate guards and security supervisors are on active patrol. If you need urgent help, tap the button above or call below.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600">Active Incident Broadcasts</h2>
            {active.map((a: any) => (
              <Card key={a.id} className="border-l-4 border-l-red-600 bg-red-50/80 dark:bg-red-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Siren className="h-5 w-5 text-red-600 animate-pulse" />
                      <p className="text-sm font-bold text-red-700 dark:text-red-400">{a.type}</p>
                    </div>
                    <Badge variant="destructive">{a.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                    <Clock className="h-3.5 w-3.5" /> Raised {new Date(a.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Emergency Helplines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-primary" /> Emergency Quick Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <a
              href="tel:108"
              className="flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all hover:bg-muted"
            >
              <span className="text-lg font-bold text-red-600">108</span>
              <span className="text-xs font-medium">Ambulance</span>
            </a>
            <a
              href="tel:101"
              className="flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all hover:bg-muted"
            >
              <span className="text-lg font-bold text-orange-600">101</span>
              <span className="text-xs font-medium">Fire Brigade</span>
            </a>
            <a
              href="tel:100"
              className="flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all hover:bg-muted"
            >
              <span className="text-lg font-bold text-blue-600">100</span>
              <span className="text-xs font-medium">Police</span>
            </a>
            <a
              href="tel:112"
              className="flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all hover:bg-muted"
            >
              <span className="text-lg font-bold text-purple-600">112</span>
              <span className="text-xs font-medium">National Helpline</span>
            </a>
          </CardContent>
        </Card>

        {resolved.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Past Incidents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {resolved.map((a: any) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{a.type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <EmergencyModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          units={units}
          onSuccess={loadAlerts}
        />
      </div>
    </AppShell>
  );
}
