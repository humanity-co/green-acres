"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, Building2, LogOut, ShieldAlert, ArrowLeftRight, ChevronDown, Search, Check, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getNavForRoles, bottomNavItems } from "@/lib/navigation";
import { toast } from "sonner";
import { EmergencyModal } from "@/components/shared/EmergencyModal";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { getPlatformInfo } from "@/lib/os";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [society, setSociety] = useState<any>(null);
  const [societies, setSocieties] = useState<any[]>([]);
  const [activeMode, setActiveMode] = useState<"RESIDENT" | "GUARD" | "ADMIN" | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hasEmergency, setHasEmergency] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl+K");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("society_active_mode") as any;
      if (saved) setActiveMode(saved);
    } catch {}

    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) {
        setUser(d.user);
        setRoles(d.roles?.map((r: any) => r.role) || ["RESIDENT"]);
      }
    }).catch(() => {});

    fetch("/api/societies").then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length) {
        setSocieties(d);
        setSociety(d[0]);
      }
    }).catch(() => {});

    const fetchUnread = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetch("/api/notifications").then(r => r.json()).then(d => {
        if (Array.isArray(d)) setUnread(d.filter((n: any) => !n.readAt).length);
      }).catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);

    const fetchEmergency = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetch("/api/emergency").then(r => r.json()).then(d => {
        if (Array.isArray(d)) setHasEmergency(d.some((a: any) => a.status === "OPEN"));
      }).catch(() => {});
    };
    fetchEmergency();
    const id2 = setInterval(fetchEmergency, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUnread();
        fetchEmergency();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const info = getPlatformInfo();
    setShortcutLabel(info.shortcutLabel);

    return () => {
      clearInterval(id);
      clearInterval(id2);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const switchMode = (mode: "RESIDENT" | "GUARD" | "ADMIN" | null) => {
    setActiveMode(mode);
    try {
      if (mode) localStorage.setItem("society_active_mode", mode);
      else localStorage.removeItem("society_active_mode");
    } catch {}
  };

  async function switchSociety(targetId: string) {
    if (targetId === society?.id) return;
    try {
      const res = await fetch("/api/auth/switch-society", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ societyId: targetId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        toast.error("Failed to switch society");
      }
    } catch {
      toast.error("Failed to switch society");
    }
  }

  const navSections = getNavForRoles(roles.length ? roles : ["RESIDENT"], activeMode);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    location.href = "/auth/sign-in";
  }

  // Flaw 1 Fix: Compute display role from activeMode, route context, or highest-privilege role
  const ROLE_PRIORITY: string[] = [
    "SUPER_ADMIN",
    "SOCIETY_ADMIN",
    "RWA_MEMBER",
    "ACCOUNTANT",
    "FACILITY_MANAGER",
    "SECURITY_MANAGER",
    "GUARD",
    "RESIDENT",
  ];

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "SUPER ADMIN",
    SOCIETY_ADMIN: "ESTATE ADMIN",
    RWA_MEMBER: "RWA MEMBER",
    ACCOUNTANT: "ACCOUNTANT",
    FACILITY_MANAGER: "FACILITY MGR",
    SECURITY_MANAGER: "SECURITY MGR",
    GUARD: "GATE GUARD",
    RESIDENT: "RESIDENT",
  };

  function resolveDisplayRole(): string {
    // 1. If user explicitly selected a console mode, reflect that
    if (activeMode === "ADMIN") {
      const adminRoles = roles.filter(r => ["SUPER_ADMIN", "SOCIETY_ADMIN", "RWA_MEMBER", "ACCOUNTANT", "FACILITY_MANAGER"].includes(r));
      if (adminRoles.length > 0) {
        const best = ROLE_PRIORITY.find(r => adminRoles.includes(r));
        return ROLE_LABELS[best || adminRoles[0]] || adminRoles[0].replace(/_/g, " ");
      }
      return "ADMIN";
    }
    if (activeMode === "GUARD") return "GATE GUARD";
    if (activeMode === "RESIDENT") return "RESIDENT";

    // 2. Infer from current route
    if (pathname.startsWith("/admin")) {
      const adminRoles = roles.filter(r => ["SUPER_ADMIN", "SOCIETY_ADMIN", "RWA_MEMBER", "ACCOUNTANT", "FACILITY_MANAGER"].includes(r));
      if (adminRoles.length > 0) {
        const best = ROLE_PRIORITY.find(r => adminRoles.includes(r));
        return ROLE_LABELS[best || adminRoles[0]] || adminRoles[0].replace(/_/g, " ");
      }
    }
    if (pathname.startsWith("/guard")) return "GATE GUARD";

    // 3. Fallback: highest-privilege role
    const bestRole = ROLE_PRIORITY.find(r => roles.includes(r)) || roles[0] || "RESIDENT";
    return ROLE_LABELS[bestRole] || bestRole.replace(/_/g, " ");
  }

  const primaryRole = resolveDisplayRole();

  const Nav = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-6" aria-label="Primary">
      {navSections.map(section => (
        <div key={section.title}>
          <p className="px-2.5 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/80 mb-2">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map(item => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClick}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <EmergencyModal open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen} />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} onTriggerEmergency={() => setEmergencyModalOpen(true)} roles={roles} />

      {/* High-Precision Top Command Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 backdrop-blur-md px-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" aria-label="Open navigation">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-14 items-center gap-2.5 border-b px-4">
                <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-mono text-xs font-bold">
                  SO
                </div>
                <span className="text-sm font-semibold tracking-tight">Society OS</span>
              </div>
              <div className="p-4 overflow-auto"><Nav onClick={() => setOpen(false)} /></div>
            </SheetContent>
          </Sheet>

          {/* Society Badge & Identity */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center transition-transform group-hover:scale-95 duration-150">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs sm:text-sm font-semibold tracking-tight leading-none text-foreground">
                  {society?.name || "Green Acres"}
                </p>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Online synced" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide font-mono">
                {society?.code || "GAR001"} • {primaryRole.replace(/_/g, " ")}
              </p>
            </div>
          </Link>
        </div>

        {/* Universal Command Palette Trigger (Linear/Raycast style) */}
        <button
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 h-8 px-2.5 sm:px-3 rounded-lg border border-border/70 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline font-medium">Search commands or flats...</span>
          <span className="inline md:hidden font-medium">Search</span>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-background border border-border/60 text-muted-foreground ml-1">
            {shortcutLabel}
          </span>
        </button>

        {/* Right Controls Hub */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick SOS Trigger */}
          <Button
            size="sm"
            onClick={() => setEmergencyModalOpen(true)}
            className="h-8 px-2.5 sm:px-3 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm border border-red-700/50"
            aria-label="Trigger Emergency SOS"
          >
            <ShieldAlert className="h-3.5 w-3.5 sm:mr-1.5 shrink-0" />
            <span className="hidden sm:inline">SOS Emergency</span>
          </Button>

          {/* Notifications */}
          <Link
            href="/notifications"
            aria-label={`Notifications ${unread ? `(${unread} unread)` : ""}`}
            className="relative inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-600" />
            )}
          </Link>

          {hasEmergency && (
            <Link
              href="/emergency"
              className="inline-flex items-center justify-center h-8 px-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-300 text-xs font-semibold animate-pulse"
            >
              Alert Open
            </Link>
          )}

          {/* User Profile Tray */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border/80 pl-1 pr-2 py-0.5 hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[11px] font-semibold bg-primary text-primary-foreground">
                      {user.fullName?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-xs font-medium text-foreground max-w-[120px] truncate">
                    {user.fullName}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5 border-b border-border/60">
                  <p className="text-xs font-semibold truncate">{user.fullName}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{user.phone}</p>
                </div>

                {societies.length > 1 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Societies
                    </div>
                    {societies.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => switchSociety(s.id)}
                        className="cursor-pointer flex items-center justify-between text-xs py-1"
                      >
                        <span className="truncate">{s.name}</span>
                        {s.id === society?.id && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                {(roles.some(r => ["GUARD", "SECURITY_MANAGER"].includes(r)) || roles.some(r => ["SUPER_ADMIN", "SOCIETY_ADMIN", "RWA_MEMBER", "ACCOUNTANT", "FACILITY_MANAGER"].includes(r))) && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Console View
                    </div>
                    <DropdownMenuItem onClick={() => switchMode("RESIDENT")} className="cursor-pointer flex items-center justify-between text-xs py-1">
                      <span>Resident Portal</span>
                      {activeMode === "RESIDENT" && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                    </DropdownMenuItem>
                    {roles.some(r => ["GUARD", "SECURITY_MANAGER", "SUPER_ADMIN", "SOCIETY_ADMIN"].includes(r)) && (
                      <DropdownMenuItem onClick={() => switchMode("GUARD")} className="cursor-pointer flex items-center justify-between text-xs py-1">
                        <span>Guard Terminal</span>
                        {activeMode === "GUARD" && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                      </DropdownMenuItem>
                    )}
                    {roles.some(r => ["SUPER_ADMIN", "SOCIETY_ADMIN", "RWA_MEMBER", "ACCOUNTANT", "FACILITY_MANAGER"].includes(r)) && (
                      <DropdownMenuItem onClick={() => switchMode("ADMIN")} className="cursor-pointer flex items-center justify-between text-xs py-1">
                        <span>Admin Hub</span>
                        {activeMode === "ADMIN" && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                      </DropdownMenuItem>
                    )}
                    {activeMode && (
                      <DropdownMenuItem onClick={() => switchMode(null)} className="cursor-pointer text-[11px] text-muted-foreground py-1">
                        <span>Reset to Default</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem onClick={() => location.href = "/auth/sign-in"} className="cursor-pointer">
                  <ArrowLeftRight className="h-3.5 w-3.5 mr-2" />
                  <span>Switch Account</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 cursor-pointer">
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth/sign-in">
              <Button size="sm" className="h-8 text-xs font-medium">Sign in</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="mx-auto flex max-w-[1440px]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-border/70 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto p-4 bg-card/40">
          <Nav />
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-8 py-6 sm:py-8 pb-24 lg:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* Frosted Glass Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/80 bg-background/85 backdrop-blur-md" aria-label="Mobile bottom navigation">
        <div className="grid grid-cols-5">
          {bottomNavItems.map(item => {
            const active = pathname === item.href;
            const isNotifications = item.href === "/notifications";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} aria-hidden />
                  {isNotifications && unread > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex h-2 w-2 rounded-full bg-red-600" />
                  )}
                </span>
                <span className="leading-none tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
