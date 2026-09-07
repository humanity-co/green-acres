"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Search, QrCode, Shield, Clock, KeyRound, LogIn, LogOut, RefreshCw } from "lucide-react";

interface InviteItem {
  invite: any;
  visitor: any;
  unit: any;
  entry: any;
}

export default function AdminGatePass() {
  const [invites, setInvites] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [inside, setInside] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadInvites = () => {
    setLoading(true);
    fetch("/api/guard/expected")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setInvites(Array.isArray(d) ? d : []))
      .catch(() => setError("Failed to load gate passes"))
      .finally(() => setLoading(false));
  };

  const loadInside = () => {
    setEntriesLoading(true);
    fetch("/api/guard/inside")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        if (Array.isArray(d)) {
          setInside(d);
        }
      })
      .catch(() => {})
      .finally(() => setEntriesLoading(false));
  };

  useEffect(() => {
    loadInvites();
    loadInside();
  }, []);

  const filtered = invites.filter((it: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      it.visitor?.name?.toLowerCase().includes(q) ||
      it.invite?.code?.toLowerCase().includes(q) ||
      it.unit?.number?.toLowerCase().includes(q) ||
      it.visitor?.phone?.includes(q)
    );
  });

  const activeCount = invites.filter((it: any) => it.invite?.status === "APPROVED").length;
  const usedCount = invites.filter((it: any) => it.invite?.status === "USED" || it.invite?.status === "CHECKED_IN").length;
  const insideCount = inside.length;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Gate Pass Registry" description="Visitor pass oversight • search by code, name, or flat" />

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-foreground">{invites.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Passes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-emerald-600">{activeCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active / Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-amber-600">{usedCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Used / Checked In</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-blue-600">{insideCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Inside Campus Now</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="passes">
          <TabsList>
            <TabsTrigger value="passes" className="text-xs"><KeyRound className="h-3.5 w-3.5 mr-1.5" />Expected Passes</TabsTrigger>
            <TabsTrigger value="inside" className="text-xs"><LogIn className="h-3.5 w-3.5 mr-1.5" />Inside Campus</TabsTrigger>
          </TabsList>

          <TabsContent value="passes" className="space-y-3 mt-3">
            {/* Search Bar */}
            <Card>
              <CardContent className="p-3 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by pass code, visitor name, phone, or flat..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button variant="outline" onClick={loadInvites}>
                  <RefreshCw className="h-4 w-4 mr-1" />Refresh
                </Button>
              </CardContent>
            </Card>

            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : error ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={loadInvites}>Retry</Button>
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<QrCode className="h-5 w-5" />}
                title={search ? "No passes match your search" : "No active gate passes"}
                description="Visitor invites created by residents appear here."
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((it: any) => {
                  const isExpired = it.invite?.validTo && new Date(it.invite.validTo).getTime() < Date.now();
                  return (
                    <Card
                      key={it.invite?.id}
                      className={`transition-colors ${isExpired ? "opacity-60 border-border/50" : "hover:bg-muted/20"}`}
                    >
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isExpired ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                            {it.visitor?.name?.[0]?.toUpperCase() || "V"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold truncate">{it.visitor?.name}</p>
                              <Badge variant="outline" className="font-mono text-xs shrink-0">
                                {it.invite?.code}
                              </Badge>
                              <StatusBadge status={it.invite?.status || "PENDING"} />
                              {isExpired && <Badge variant="destructive" className="text-[10px]">EXPIRED</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {it.visitor?.phone} • Unit {it.unit?.number || "—"} • {it.invite?.purpose}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              Valid: {it.invite?.validFrom ? new Date(it.invite.validFrom).toLocaleString() : "—"} → {it.invite?.validTo ? new Date(it.invite.validTo).toLocaleString() : "—"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="inside" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Currently Inside Society</h2>
                <Badge variant="secondary">{inside.length} visitors</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={loadInside}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            </div>

            {entriesLoading ? (
              <LoadingSkeleton rows={3} />
            ) : inside.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No visitors inside"
                description="Checked-in visitors appear here."
              />
            ) : (
              <div className="space-y-2">
                {inside.map((it: any) => {
                  const overstayed = it.invite?.validTo && new Date(it.invite.validTo).getTime() < Date.now();
                  return (
                    <Card
                      key={it.entry?.id}
                      className={overstayed ? "border-2 border-red-400 bg-red-50/30 dark:bg-red-950/20" : ""}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-medium shrink-0 ${overstayed ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {it.visitor?.name?.[0] || "V"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{it.visitor?.name}</p>
                            <Badge variant="outline" className="text-xs">Unit {it.unit?.number || "—"}</Badge>
                            {overstayed && <Badge variant="destructive" className="text-[10px]">OVERSTAY</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            In since {it.entry?.checkIn ? new Date(it.entry.checkIn).toLocaleTimeString() : "—"}
                            {it.invite?.validTo && (
                              <span className={overstayed ? " text-red-600 font-semibold ml-1" : " ml-1"}>
                                • Pass valid till {new Date(it.invite.validTo).toLocaleTimeString()}
                              </span>
                            )}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
