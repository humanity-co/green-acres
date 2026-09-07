"use client";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Shield, Calendar, Megaphone, FileText } from "lucide-react";
export default function ReportsHub() {
  const items = [
    { href: "/admin/reports/finance", label: "Finance", icon: Wallet, desc: "Billed, collected, outstanding, paise-exact" },
    { href: "/admin/reports/security", label: "Security", icon: Shield, desc: "Visitors, deliveries, help, vehicles" },
    { href: "/admin/reports/amenities", label: "Amenities", icon: Calendar, desc: "Bookings, most-used, cancellations" },
    { href: "/admin/reports/community", label: "Community", icon: Megaphone, desc: "Announcements, polls, events, emergencies" },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: FileText, desc: "Append-only, newest first" },
  ];
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Reports" description="Tenant-scoped, server-authoritative, paise-exact where financial" />
        <div className="grid md:grid-cols-2 gap-3">
          {items.map(it => (
            <Link key={it.href} href={it.href}>
              <Card className="hover:bg-muted/30 h-full">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><it.icon className="h-4 w-4" />{it.label}</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{it.desc}</p></CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
