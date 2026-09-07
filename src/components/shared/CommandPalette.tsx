"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  UserPlus,
  CreditCard,
  Calendar,
  Wrench,
  ShieldAlert,
  ArrowLeftRight,
  Shield,
  BarChart3,
  Users,
  Truck,
  HeartHandshake,
  Car,
  SquareParking,
  ClipboardList,
  Wallet,
  Megaphone,
  Vote,
  Siren,
  Bell,
  ScrollText,
  User,
  Home,
  CornerDownLeft,
  X,
} from "lucide-react";
import { getPlatformInfo } from "@/lib/os";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerEmergency?: () => void;
  roles?: string[];
}

type CommandItem = {
  id: string;
  category: "Quick Actions" | "Navigation" | "Operations";
  label: string;
  sub?: string;
  icon: any;
  action: () => void;
  badge?: string;
  color?: string;
};

export function CommandPalette({ open, onOpenChange, onTriggerEmergency, roles = [] }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl+K");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isGuard = roles.some(r => ["GUARD", "SECURITY_MANAGER"].includes(r));
  const isAdmin = roles.some(r => ["SUPER_ADMIN", "SOCIETY_ADMIN", "RWA_MEMBER", "ACCOUNTANT", "FACILITY_MANAGER"].includes(r));

  useEffect(() => {
    const info = getPlatformInfo();
    setShortcutLabel(info.shortcutLabel);
  }, []);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const allItems: CommandItem[] = useMemo(() => [
    // Quick Actions
    {
      id: "action-invite",
      category: "Quick Actions",
      label: "Pre-Approve Guest Pass",
      sub: "Generate 6-digit visitor PIN & QR pass",
      icon: UserPlus,
      action: () => { onOpenChange(false); router.push("/visitors/new"); },
    },
    {
      id: "action-pay",
      category: "Quick Actions",
      label: "Pay Maintenance Dues",
      sub: "View outstanding invoices and clear balance",
      icon: CreditCard,
      action: () => { onOpenChange(false); router.push("/bills"); },
    },
    {
      id: "action-emergency",
      category: "Quick Actions",
      label: "Sound Emergency SOS Alarm",
      sub: "Broadcast immediate alert to guards & estate management",
      icon: ShieldAlert,
      color: "text-red-600 dark:text-red-400",
      action: () => {
        onOpenChange(false);
        if (onTriggerEmergency) onTriggerEmergency();
        else router.push("/emergency");
      },
    },
    {
      id: "action-amenity",
      category: "Quick Actions",
      label: "Book Amenity Slot",
      sub: "Reserve swimming pool, clubhouse, or gym",
      icon: Calendar,
      action: () => { onOpenChange(false); router.push("/amenities"); },
    },
    {
      id: "action-ticket",
      category: "Quick Actions",
      label: "File Maintenance Ticket",
      sub: "Report plumbing, electrical, or housekeeping issue",
      icon: Wrench,
      action: () => { onOpenChange(false); router.push("/helpdesk/new"); },
    },
    {
      id: "action-switch",
      category: "Quick Actions",
      label: "Switch Role / Account",
      sub: "Sign in as Resident, Guard, or Society Admin",
      icon: ArrowLeftRight,
      action: () => { onOpenChange(false); router.push("/auth/sign-in"); },
    },

    // Navigation - Core
    {
      id: "nav-home",
      category: "Navigation",
      label: "Resident Dashboard",
      sub: "Personal flat overview and estate actions",
      icon: Home,
      action: () => { onOpenChange(false); router.push("/"); },
    },
    {
      id: "nav-guard",
      category: "Navigation",
      label: "Gate Terminal Console",
      sub: "Security guard pass scanner, walk-ins, and visitor log",
      icon: Shield,
      badge: "Guard",
      action: () => { onOpenChange(false); router.push("/guard"); },
    },
    {
      id: "nav-admin",
      category: "Navigation",
      label: "Operations Command Hub",
      sub: "Executive society telemetry and financial ledger",
      icon: BarChart3,
      badge: "Admin",
      action: () => { onOpenChange(false); router.push("/admin"); },
    },
    {
      id: "nav-visitors",
      category: "Navigation",
      label: "Visitor Passes",
      sub: "Expected guests, active entries, and past history",
      icon: Users,
      action: () => { onOpenChange(false); router.push("/visitors"); },
    },
    {
      id: "nav-deliveries",
      category: "Navigation",
      label: "Package Deliveries",
      sub: "Parcels waiting at gate terminal",
      icon: Truck,
      action: () => { onOpenChange(false); router.push("/deliveries"); },
    },
    {
      id: "nav-help",
      category: "Navigation",
      label: "Domestic Staff & Help",
      sub: "Maids, cooks, drivers, and daily attendance logs",
      icon: HeartHandshake,
      action: () => { onOpenChange(false); router.push("/help"); },
    },
    {
      id: "nav-vehicles",
      category: "Navigation",
      label: "Vehicles & Parking",
      sub: "Registered license plates and parking slots",
      icon: Car,
      action: () => { onOpenChange(false); router.push("/vehicles"); },
    },
    {
      id: "nav-bills",
      category: "Navigation",
      label: "Maintenance & Billing",
      sub: "Invoices, payment receipts, and society dues",
      icon: Wallet,
      action: () => { onOpenChange(false); router.push("/bills"); },
    },
    {
      id: "nav-helpdesk",
      category: "Navigation",
      label: "Helpdesk & Service Tickets",
      sub: "Track status of community service requests",
      icon: Wrench,
      action: () => { onOpenChange(false); router.push("/helpdesk"); },
    },
    {
      id: "nav-announcements",
      category: "Navigation",
      label: "Estate Announcements",
      sub: "Official RWA circulars and updates",
      icon: Megaphone,
      action: () => { onOpenChange(false); router.push("/announcements"); },
    },
    {
      id: "nav-polls",
      category: "Navigation",
      label: "Community Polls",
      sub: "Vote on society resolutions and decisions",
      icon: Vote,
      action: () => { onOpenChange(false); router.push("/community/polls"); },
    },
    {
      id: "nav-emergency",
      category: "Navigation",
      label: "Emergency Protocol & Helplines",
      sub: "Direct hotlines (108, 101, 100, 112) and alarm status",
      icon: Siren,
      action: () => { onOpenChange(false); router.push("/emergency"); },
    },
    {
      id: "nav-audit",
      category: "Operations",
      label: "System Audit Logs",
      sub: "Immutable tenant audit logs and security mutations",
      icon: ScrollText,
      badge: "Admin",
      action: () => { onOpenChange(false); router.push("/admin/audit-logs"); },
    },
    {
      id: "nav-finance",
      category: "Operations",
      label: "Financial Audit Report",
      sub: "Paise-exact SQL aggregated billing and collection balances",
      icon: BarChart3,
      badge: "Admin",
      action: () => { onOpenChange(false); router.push("/admin/reports/finance"); },
    },
  ], [onOpenChange, router, onTriggerEmergency]);

  // Filter items based on roles and query
  const filteredItems = useMemo(() => {
    const roleFiltered = allItems.filter(item => {
      if (item.badge === "Admin" && !isAdmin) return false;
      if (item.badge === "Guard" && !isGuard && !isAdmin) return false;
      return true;
    });

    if (!query.trim()) return roleFiltered;
    const q = query.toLowerCase().trim();
    return roleFiltered.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.sub?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query, isAdmin, isGuard]);

  // Handle arrow key navigation
  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) selected.action();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in-0 duration-150"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-xl bg-card border border-border/80 rounded-2xl shadow-[0_16px_70px_rgba(0,0,0,0.2)] overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/70 gap-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyNav}
            placeholder="Type a command, flat, or search..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none tracking-tight font-medium"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-secondary text-muted-foreground border border-border/60">
            {shortcutLabel}
          </span>
        </div>

        {/* Results Stream */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 divide-y divide-border/40">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors duration-100 ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-secondary/70 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-secondary text-muted-foreground border border-border/40"
                        } ${item.color || ""}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-tight truncate">{item.label}</p>
                        {item.sub && (
                          <p
                            className={`text-[10px] truncate ${
                              isSelected ? "text-primary-foreground/75" : "text-muted-foreground"
                            }`}
                          >
                            {item.sub}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-secondary text-muted-foreground border border-border/60"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isSelected && (
                        <CornerDownLeft className="h-3 w-3 text-primary-foreground/70" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 bg-secondary/40 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <span><strong className="text-foreground">↑↓</strong> Navigate</span>
            <span><strong className="text-foreground">↵</strong> Select</span>
            <span><strong className="text-foreground">ESC</strong> Close</span>
          </div>
          <span>Society OS Universal Navigation</span>
        </div>
      </div>
    </div>
  );
}
