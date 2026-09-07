"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Shield,
  Truck,
  HeartHandshake,
  Car,
  Calendar,
  Wallet,
  Siren,
  Megaphone,
  BarChart3,
  Wrench,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import { formatPaise } from "@/lib/format";

export default function AdminOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="h-20 bg-muted/60 animate-pulse rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted/50 animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data || data.error) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto py-12">
          <Card className="border-border/80">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Failed to load executive overview. {data?.error}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const f = data.finance;
  const collectionRate = f.totalBilledPaise > 0
    ? Math.round((f.collectedPaise / f.totalBilledPaise) * 100)
    : 100;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Page Header */}
        <PageHeader
          eyebrow="Estate Administration"
          title="Operations Command Hub"
          description="Real-time society telemetry, gate logs, and server-authoritative financial ledgers."
          action={
            <div className="flex gap-2">
              <Link href="/admin/reports/finance">
                <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
                  <Wallet className="h-3.5 w-3.5 mr-1.5" /> Finance Audit
                </Button>
              </Link>
              <Link href="/admin/audit-logs">
                <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
                  <ScrollText className="h-3.5 w-3.5 mr-1.5" /> System Logs
                </Button>
              </Link>
            </div>
          }
        />

        {/* 8-Card Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Residential Units"
            value={data.totalUnits}
            icon={<Building2 className="h-4 w-4" />}
            sub={`${data.residents} verified residents`}
          />
          <StatCard
            label="Visitors Inside"
            value={data.visitorsInside}
            icon={<Shield className="h-4 w-4" />}
            sub={`${data.visitorsToday} arrivals today`}
            trend={data.visitorsInside > 0 ? "Active Gate Pass" : undefined}
          />
          <StatCard
            label="Pending Deliveries"
            value={data.pendingDeliveries}
            icon={<Truck className="h-4 w-4" />}
            sub="At security gate"
          />
          <StatCard
            label="Staff On-Site"
            value={data.helpInside}
            icon={<HeartHandshake className="h-4 w-4" />}
            sub="Domestic attendance"
          />
          <StatCard
            label="Vehicles Registered"
            value={data.vehicles}
            icon={<Car className="h-4 w-4" />}
            sub="RFID / stickers active"
          />
          <StatCard
            label="Facility Bookings"
            value={data.activeBookings}
            icon={<Calendar className="h-4 w-4" />}
            sub="Pool & clubhouse"
          />
          <StatCard
            label="Open Service Tickets"
            value={data.ticketsOpen}
            icon={<Wrench className="h-4 w-4" />}
            sub="Under resolution"
          />
          <StatCard
            label="Active Emergencies"
            value={data.emergenciesOpen}
            icon={<Siren className="h-4 w-4 text-red-600" />}
            sub={data.emergenciesOpen === 0 ? "Zero incidents open" : "Immediate action required"}
            trend={data.emergenciesOpen === 0 ? "All Clear" : undefined}
          />
        </div>

        {/* Financial Ledger Deck (Stripe Style) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Collection Gauge */}
          <Card className="lg:col-span-2 border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <CardHeader className="pb-2 border-b border-border/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Society Maintenance Ledger</CardTitle>
                <p className="text-xs text-muted-foreground font-mono">Server-aggregated totals across all flat accounts</p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-secondary border border-border/70">
                {collectionRate}% COLLECTED
              </span>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Invoiced</p>
                  <p className="text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums mt-1 text-foreground">
                    {formatPaise(f.totalBilledPaise)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{f.billCount} total bills</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Collected</p>
                  <p className="text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                    {formatPaise(f.collectedPaise)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Cleared via UPI/Gateway</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Outstanding Balance</p>
                  <p className="text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums mt-1 text-amber-600 dark:text-amber-400">
                    {formatPaise(f.outstandingPaise)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{f.overdueCount} pending dues</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 pt-2">
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, collectionRate))}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Ledger Action Card */}
          <Card className="border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <CardHeader className="pb-2 border-b border-border/60">
              <CardTitle className="text-sm font-semibold tracking-tight">FinOps Controls</CardTitle>
              <p className="text-xs text-muted-foreground">Reconciliation and billing workflows</p>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              <Link href="/admin/bills" className="block">
                <Button variant="outline" className="w-full justify-between h-9 text-xs font-medium">
                  <span>Issue Maintenance Bills</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/admin/payments" className="block">
                <Button variant="outline" className="w-full justify-between h-9 text-xs font-medium">
                  <span>Payment Gateway Logs</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/admin/reports/finance" className="block">
                <Button variant="outline" className="w-full justify-between h-9 text-xs font-medium">
                  <span>Full Financial Ledger</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Engagement & Community Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin/announcements" className="group">
            <Card className="border border-border/80 bg-card hover:border-foreground/30 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono tracking-tight text-foreground">{data.announcements}</p>
                    <p className="text-xs text-muted-foreground">Announcements</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/polls" className="group">
            <Card className="border border-border/80 bg-card hover:border-foreground/30 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono tracking-tight text-foreground">{data.polls}</p>
                    <p className="text-xs text-muted-foreground">Community Polls</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/events" className="group">
            <Card className="border border-border/80 bg-card hover:border-foreground/30 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono tracking-tight text-foreground">{data.events}</p>
                    <p className="text-xs text-muted-foreground">Society Events</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Security & Isolation Footnote */}
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>PostgreSQL FORCE RLS Isolated • Paise-exact mathematical financial summation</span>
          </div>
          <span>API: /api/admin/overview</span>
        </div>
      </div>
    </AppShell>
  );
}
