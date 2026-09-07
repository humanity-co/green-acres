"use client";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building2, Users, Car, ChevronRight, Home, Wrench } from "lucide-react";

interface UnitItem {
  unit: any;
  building: any;
  floor: any;
  memberCount: number;
  vehicleCount: number;
}

interface UnitDetail {
  unit: any;
  members: any[];
  vehicles: any[];
}

export default function AdminUnits() {
  const [items, setItems] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Sheet state
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [unitDetail, setUnitDetail] = useState<UnitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/units?limit=100");
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {
      toast.error("Failed to load units");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((it) =>
    !q ||
    it.unit.number.toLowerCase().includes(q.toLowerCase()) ||
    it.building?.name?.toLowerCase().includes(q.toLowerCase())
  );

  async function openUnitDetail(item: UnitItem) {
    setSelectedUnit(item);
    setSheetOpen(true);
    setDetailLoading(true);
    setUnitDetail(null);

    try {
      // Fetch unit details - the API returns the unit record
      const unitRes = await fetch(`/api/units/${item.unit.id}`);
      const unitData = unitRes.ok ? await unitRes.json() : item.unit;

      // Try to fetch members and vehicles for this unit via guard search
      let members: any[] = [];
      let vehicles: any[] = [];

      try {
        const searchRes = await fetch(`/api/guard/resident-search?q=${encodeURIComponent(item.unit.number)}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData)) {
            const match = searchData.find((r: any) => r.unit?.id === item.unit.id);
            if (match) {
              members = match.residents || [];
              vehicles = match.vehicles || [];
            }
          }
        }
      } catch {
        // Resident search endpoint may not be accessible for admin; graceful fallback
      }

      setUnitDetail({
        unit: unitData,
        members,
        vehicles,
      });
    } catch {
      toast.error("Failed to load unit details");
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateUnitStatus(newStatus: string) {
    if (!selectedUnit) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/units/${selectedUnit.unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update");
      }
      const updated = await res.json();
      toast.success(`Unit ${selectedUnit.unit.number} status updated to ${newStatus}`);

      // Update local state
      setItems(prev => prev.map(it =>
        it.unit.id === selectedUnit.unit.id
          ? { ...it, unit: { ...it.unit, status: newStatus } }
          : it
      ));
      setSelectedUnit(prev => prev ? { ...prev, unit: { ...prev.unit, status: newStatus } } : null);
    } catch (e: any) {
      toast.error(e.message || "Failed to update unit status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) return <AppShell><div className="max-w-6xl mx-auto"><LoadingSkeleton rows={5} /></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader title="Units" description="Buildings • Floors • Occupancy" />
        <Card>
          <CardContent className="p-3 flex gap-2">
            <Input
              placeholder="Filter unit or building"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={load}>Refresh</Button>
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <EmptyState icon={<Building2 className="h-5 w-5" />} title="No units" description="No units match." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {filtered.slice(0, 100).map((it) => (
              <Card
                key={it.unit.id}
                className="cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-all duration-150 group focus-within:ring-2 focus-within:ring-ring"
                onClick={() => openUnitDetail(it)}
                tabIndex={0}
                role="button"
                aria-label={`View unit ${it.unit.number} details`}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openUnitDetail(it); } }}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{it.unit.number}</p>
                      <Badge variant="outline">{it.unit.type}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={
                        it.unit.status === "OCCUPIED" ? "bg-emerald-600" :
                        it.unit.status === "VACANT" ? "bg-amber-500" :
                        it.unit.status === "UNDER_MAINTENANCE" ? "bg-red-500" :
                        ""
                      }>
                        {it.unit.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {it.building?.name} • Floor {it.floor?.number ?? "?"} • {it.unit.areaSqft ? `${it.unit.areaSqft} sqft` : ""}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{it.memberCount} members</span>
                    <span className="flex items-center gap-1"><Car className="h-3 w-3" />{it.vehicleCount} vehicles</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Unit Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedUnit && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <Home className="h-5 w-5" />
                  Unit {selectedUnit.unit.number}
                </SheetTitle>
                <SheetDescription>
                  {selectedUnit.building?.name} • Floor {selectedUnit.floor?.number ?? "?"} • {selectedUnit.unit.areaSqft ? `${selectedUnit.unit.areaSqft} sqft` : ""}
                </SheetDescription>
              </SheetHeader>

              <Separator />

              {/* Status Control */}
              <div className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit Status</p>
                    <Badge className={`mt-1 ${
                      selectedUnit.unit.status === "OCCUPIED" ? "bg-emerald-600" :
                      selectedUnit.unit.status === "VACANT" ? "bg-amber-500" :
                      selectedUnit.unit.status === "UNDER_MAINTENANCE" ? "bg-red-500" :
                      ""
                    }`}>
                      {selectedUnit.unit.status}
                    </Badge>
                  </div>
                  <Select
                    value={selectedUnit.unit.status}
                    onValueChange={updateUnitStatus}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OCCUPIED">Occupied</SelectItem>
                      <SelectItem value="VACANT">Vacant</SelectItem>
                      <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Changing status triggers an audit log entry. All mutations are tracked.
                </p>
              </div>

              <Separator />

              {/* Unit Metadata */}
              <div className="py-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Type</p>
                  <p className="font-medium mt-0.5">{selectedUnit.unit.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Area</p>
                  <p className="font-medium mt-0.5">{selectedUnit.unit.areaSqft ? `${selectedUnit.unit.areaSqft} sqft` : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Building</p>
                  <p className="font-medium mt-0.5">{selectedUnit.building?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Floor</p>
                  <p className="font-medium mt-0.5">{selectedUnit.floor?.number ?? "—"}</p>
                </div>
              </div>

              <Separator />

              {/* Members Section */}
              <div className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Registered Members ({selectedUnit.memberCount})
                  </p>
                </div>

                {detailLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : unitDetail?.members && unitDetail.members.length > 0 ? (
                  <div className="space-y-2">
                    {unitDetail.members.map((m: any, i: number) => (
                      <div key={m.user?.id || i} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {m.user?.fullName?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{m.user?.fullName || "Resident"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{m.user?.phone || "—"} • {m.relation || "MEMBER"}</p>
                        </div>
                        {m.isPrimary && <Badge variant="outline" className="text-[9px] shrink-0">PRIMARY</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    {selectedUnit.memberCount > 0
                      ? `${selectedUnit.memberCount} member(s) registered. Detailed info requires elevated access.`
                      : "No members registered for this unit."}
                  </p>
                )}
              </div>

              <Separator />

              {/* Vehicles Section */}
              <div className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Registered Vehicles ({selectedUnit.vehicleCount})
                  </p>
                </div>

                {detailLoading ? (
                  <div className="space-y-2">
                    {[1].map(i => (
                      <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : unitDetail?.vehicles && unitDetail.vehicles.length > 0 ? (
                  <div className="space-y-2">
                    {unitDetail.vehicles.map((v: any, i: number) => (
                      <div key={v.id || i} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                        <Car className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-mono font-bold">{v.numberPlate}</p>
                          <p className="text-[10px] text-muted-foreground">{v.type} {v.stickerNo ? `• Sticker #${v.stickerNo}` : ""}</p>
                        </div>
                        <Badge variant="secondary" className="text-[9px] shrink-0">{v.type}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    {selectedUnit.vehicleCount > 0
                      ? `${selectedUnit.vehicleCount} vehicle(s) registered. Detailed info requires elevated access.`
                      : "No vehicles registered for this unit."}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
