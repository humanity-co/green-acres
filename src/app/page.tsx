"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmergencyModal } from "@/components/shared/EmergencyModal";
import {
  Users,
  Wallet,
  Wrench,
  Megaphone,
  Building2,
  Calendar,
  Shield,
  HeartHandshake,
  Truck,
  CreditCard,
  UserPlus,
  ArrowRight,
  AlertCircle,
  Clock,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { VisitorPassModal, VisitorPassDetails } from "@/components/shared/VisitorPassCard";

export default function Dashboard() {
  const [society, setSociety] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<boolean | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<VisitorPassDetails | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me").then(r => r.json());
        if (!me.user) { setAuth(false); setLoading(false); return; }
        setUser(me.user);
        setAuth(true);
        const [s, u, iv, b, t, a, d] = await Promise.all([
          fetch("/api/societies").then(r => r.json()).catch(() => []),
          fetch("/api/me/units").then(r => r.json()).catch(() => []),
          fetch("/api/invites").then(r => r.json()).catch(() => []),
          fetch("/api/bills").then(r => r.json()).catch(() => []),
          fetch("/api/helpdesk").then(r => r.json()).catch(() => []),
          fetch("/api/announcements").then(r => r.json()).catch(() => []),
          fetch("/api/deliveries").then(r => r.json()).catch(() => []),
        ]);
        setSociety(Array.isArray(s) ? s[0] : null);
        const myUnits = Array.isArray(u) ? u.map((item: any) => item.unit || item) : [];
        setUnits(myUnits);
        setInvites(Array.isArray(iv) ? iv : []);
        setBills(Array.isArray(b) ? b : []);
        setTickets(Array.isArray(t) ? t : []);
        setAnnouncements(Array.isArray(a) ? a : []);
        setDeliveries(Array.isArray(d) ? d : []);
      } catch {
        setAuth(false);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-6">
          <LoadingSkeleton rows={4} />
        </div>
      </AppShell>
    );
  }

  if (auth === false) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-16 text-center">
          <Card className="border-border/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <CardHeader className="pb-3">
              <div className="mx-auto h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-semibold tracking-tight">Resident Portal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sign in with your registered mobile phone to view your flat, approve guests, and manage estate services.
              </p>
              <Link href="/auth/sign-in">
                <Button className="w-full font-medium">Sign in with Mobile OTP</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const unpaidBills = bills.filter(b => b.status !== "PAID");
  const pendingBillsCount = unpaidBills.length;
  const openTicketsCount = tickets.filter(t => t.status === "OPEN").length;
  const pendingDeliveriesCount = deliveries.filter((d: any) => d.status === "AT_GATE").length;
  const myUnit = units[0];

  return (
    <AppShell>
      <EmergencyModal open={emergencyOpen} onOpenChange={setEmergencyOpen} />
      <VisitorPassModal open={!!selectedPass} onOpenChange={(val) => { if (!val) setSelectedPass(null); }} pass={selectedPass} />

      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Layer 1: Executive Orientation Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground font-mono">
                {society?.code || "GAR001"} • {society?.name || "Green Acres"}
              </p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Good morning, {user?.fullName?.split(" ")[0] || "Resident"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Welcome to your personal society control deck.
            </p>
          </div>

          {/* Unit Status Pill */}
          {myUnit ? (
            <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="text-left pr-1">
                <p className="text-xs font-semibold tracking-tight text-foreground">Unit {myUnit.number}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {myUnit.type || "FLAT"} {myUnit.areaSqft ? `• ${myUnit.areaSqft} sq ft` : ""}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                <ShieldCheck className="h-2.5 w-2.5 mr-1 text-emerald-600" />
                VERIFIED
              </Badge>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs">
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Unit onboarding pending RWA verification</span>
            </div>
          )}
        </div>

        {/* Layer 2: Smart Attention Tray (Condition-based: Only renders when action is needed) */}
        {(pendingDeliveriesCount > 0 || pendingBillsCount > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingDeliveriesCount > 0 && (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                      {pendingDeliveriesCount} package{pendingDeliveriesCount > 1 ? "s" : ""} at security
                    </p>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                      Received at gate terminal • Ready for collection
                    </p>
                  </div>
                </div>
                <Link href="/deliveries">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-800">
                    View
                  </Button>
                </Link>
              </div>
            )}

            {pendingBillsCount > 0 && (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Maintenance due: {pendingBillsCount} invoice{pendingBillsCount > 1 ? "s" : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      ₹{unpaidBills.reduce((acc, b) => acc + (parseFloat(b.total) || 0), 0).toLocaleString()} total balance
                    </p>
                  </div>
                </div>
                <Link href="/bills">
                  <Button size="sm" className="h-7 text-xs font-medium">
                    Pay Now
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Layer 3: Core Precision Telemetry Hub */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Residential Units"
            value={units.length || 1}
            sub={myUnit ? `Unit ${myUnit.number}` : "Assigned"}
            icon={<Building2 className="h-4 w-4" />}
          />
          <StatCard
            label="Upcoming Guests"
            value={invites.length}
            sub="Pass PINs active"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Outstanding Dues"
            value={pendingBillsCount}
            sub={pendingBillsCount === 0 ? "All settled" : "Due this cycle"}
            icon={<Wallet className="h-4 w-4" />}
            trend={pendingBillsCount === 0 ? "Ledger Clean" : undefined}
          />
          <StatCard
            label="Service Requests"
            value={openTicketsCount}
            sub={openTicketsCount === 0 ? "No open issues" : "Under resolution"}
            icon={<Wrench className="h-4 w-4" />}
          />
        </div>

        {/* Layer 4: Linear-style High-Frequency Action Grid */}
        <section aria-labelledby="quick-actions-heading">
          <SectionHeader
            title="Estate Actions"
            description="High-frequency resident workflows"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {[
              { label: "Invite Guest", icon: UserPlus, href: "/visitors", desc: "PIN & QR pass" },
              { label: "Pay Bills", icon: CreditCard, href: "/bills", desc: `${pendingBillsCount} pending` },
              { label: "Book Amenity", icon: Calendar, href: "/amenities", desc: "Pool • Gym" },
              { label: "Helpdesk", icon: Wrench, href: "/helpdesk", desc: "Service tickets" },
              { label: "Deliveries", icon: Truck, href: "/deliveries", desc: pendingDeliveriesCount ? `${pendingDeliveriesCount} ready` : "Gate courier" },
              { label: "Domestic Help", icon: HeartHandshake, href: "/help", desc: "Maids & staff" },
            ].map(a => (
              <Link
                key={a.label}
                href={a.href}
                className="group rounded-xl border border-border/80 bg-card p-3.5 hover:border-foreground/30 hover:bg-secondary/40 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-secondary/80 flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-150">
                    <a.icon className="h-4 w-4" aria-hidden />
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold tracking-tight text-foreground">{a.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Layer 5: Structured Operational Streams (Stripe-grade Data Presentation) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Left Stream: Security & Pre-Approved Visitors */}
          <Card className="border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/60">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold tracking-tight">Upcoming Guests & Gate Passes</CardTitle>
                <p className="text-xs text-muted-foreground">Pre-approved visitors with active gate PINs</p>
              </div>
              <Link href="/visitors">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {invites.length === 0 ? (
                <EmptyState
                  title="No active guest passes"
                  description="Pre-approve visitors to give them a fast-track 6-digit gate code."
                  icon={<Users className="h-4 w-4" />}
                  actionLabel="Create Pass"
                  href="/visitors"
                />
              ) : (
                <ul className="divide-y divide-border/50">
                  {invites.slice(0, 4).map((iv: any) => (
                    <li key={iv.id} className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold tracking-wider text-foreground px-1.5 py-0.5 rounded bg-secondary">
                            {iv.code}
                          </span>
                          <span className="text-xs font-medium text-foreground truncate">{iv.purpose || "Guest Visit"}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          Valid until {new Date(iv.validTo).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={iv.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] gap-1 border-border/80 hover:bg-secondary"
                          onClick={() => setSelectedPass({
                            code: iv.code,
                            visitorName: iv.visitorName || iv.purpose || "Guest",
                            unitNumber: myUnit?.number ? `Unit ${myUnit.number}` : "Pass",
                            societyName: society?.name || "Society OS",
                            purpose: iv.purpose || "Guest Visit",
                            validFrom: iv.validFrom,
                            validTo: iv.validTo,
                          })}
                        >
                          <Share2 className="h-2.5 w-2.5" />
                          <span>Pass</span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Right Stream: Maintenance & Billing Invoices */}
          <Card className="border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/60">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold tracking-tight">Society Maintenance Invoices</CardTitle>
                <p className="text-xs text-muted-foreground">Maintenance dues issued by estate accounting</p>
              </div>
              <Link href="/bills">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {bills.length === 0 ? (
                <EmptyState
                  title="No maintenance invoices"
                  description="Your flat is in good standing with zero unpaid society dues."
                  icon={<Wallet className="h-4 w-4" />}
                />
              ) : (
                <ul className="divide-y divide-border/50">
                  {bills.slice(0, 4).map((b: any) => (
                    <li key={b.id} className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{b.title}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          Due {b.dueDate} • ₹{b.total}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={b.status} />
                        {b.status !== "PAID" && (
                          <Link href={`/bills`}>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] font-medium">
                              Pay
                            </Button>
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Bottom Left: Announcements Feed */}
          <Card className="border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/60">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold tracking-tight">Estate Announcements</CardTitle>
                <p className="text-xs text-muted-foreground">Official RWA updates and notices</p>
              </div>
              <Link href="/announcements">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                  All notices
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {announcements.length === 0 ? (
                <EmptyState
                  title="No active notices"
                  description="Society circulars and notices will be posted here."
                  icon={<Megaphone className="h-4 w-4" />}
                />
              ) : (
                <ul className="divide-y divide-border/50">
                  {announcements.slice(0, 3).map((a: any) => (
                    <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="text-xs font-semibold text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{a.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Bottom Right: Helpdesk & Requests */}
          <Card className="border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/60">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold tracking-tight">Helpdesk & Maintenance Tickets</CardTitle>
                <p className="text-xs text-muted-foreground">Plumbing, electrical, and facility requests</p>
              </div>
              <Link href="/helpdesk">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {tickets.length === 0 ? (
                <EmptyState
                  title="No open maintenance tickets"
                  description="Report any maintenance or facility issue to estate management."
                  icon={<Wrench className="h-4 w-4" />}
                  actionLabel="File Ticket"
                  href="/helpdesk/new"
                />
              ) : (
                <ul className="divide-y divide-border/50">
                  {tickets.slice(0, 3).map((t: any) => (
                    <li key={t.id} className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {t.category} • {t.priority}
                        </p>
                      </div>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
