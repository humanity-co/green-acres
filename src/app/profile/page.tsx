"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { User, Building2, Shield, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [society, setSociety] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.json());
        if (!me.user) { setAuth(false); setLoading(false); return; }
        setUser(me.user);
        setRoles(me.roles?.map((r: any) => r.role) || []);
        setAuth(true);
        const [s, u] = await Promise.all([
          fetch("/api/societies").then((r) => r.json()).catch(() => []),
          fetch("/api/units").then((r) => r.json()).catch(() => []),
        ]);
        if (Array.isArray(s) && s[0]) setSociety(s[0]);
        if (Array.isArray(u)) setUnits(u);
      } catch { setAuth(false); } finally { setLoading(false); }
    }
    load();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    location.href = "/auth/sign-in";
  }

  if (loading) return <AppShell><div className="max-w-3xl mx-auto"><LoadingSkeleton rows={4} /></div></AppShell>;
  if (auth === false || !user) return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Sign in to view profile</h2>
            <p className="text-sm text-muted-foreground mt-1">Phone OTP authentication required.</p>
            <Link href="/auth/sign-in"><Button className="mt-4">Sign in with phone</Button></Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Profile" description="Your account • society and access" />

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold shrink-0">{user.fullName?.[0]?.toUpperCase() || "U"}</div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{user.fullName}</h2>
                <p className="text-sm text-muted-foreground">{user.phone}</p>
                {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                  {!roles.length && <Badge variant="secondary">RESIDENT</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Society</CardTitle></CardHeader>
            <CardContent>
              {society ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{society.name}</p>
                  <p className="text-xs text-muted-foreground">{society.code} • {society.city}</p>
                  {society.address && <p className="text-xs text-muted-foreground">{society.address}</p>}
                  <Badge variant="outline" className="mt-2">{society.code}</Badge>
                </div>
              ) : <p className="text-sm text-muted-foreground">No society assigned</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Unit</CardTitle></CardHeader>
            <CardContent>
              {units.length ? (
                <div className="space-y-2">
                  {units.slice(0, 3).map((u: any) => (
                    <div key={u.id} className="rounded border px-3 py-2">
                      <p className="text-sm font-medium">{u.number} <Badge variant="outline" className="ml-1">{u.type}</Badge></p>
                      <p className="text-xs text-muted-foreground">{u.areaSqft ? `${u.areaSqft} sq ft` : ""} • {u.status}</p>
                    </div>
                  ))}
                  {units.length > 3 && <p className="text-xs text-muted-foreground">+{units.length - 3} more</p>}
                </div>
              ) : <p className="text-sm text-muted-foreground">No unit linked</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Access</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs">{user.id.slice(0, 8)}…</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Roles</span><span className="font-medium">{roles.join(", ") || "RESIDENT"}</span></div>
            <p className="text-xs text-muted-foreground">Role mutation is read-only in MVP. Contact society admin for changes.</p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={logout} aria-label="Sign out"><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
          <Link href="/"><Button variant="ghost">Back to home</Button></Link>
        </div>
      </div>
    </AppShell>
  );
}
