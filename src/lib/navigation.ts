import { Home, Users, Building2, Shield, Truck, HeartHandshake, Wallet, Wrench, Megaphone, User, Bell, Calendar, CreditCard, ClipboardList, BarChart3, ScrollText, Car, SquareParking, Vote, Siren } from "lucide-react";

export type NavItem = { label: string; href: string; icon: any; badge?: string };
export type NavSection = { title: string; items: NavItem[] };

export const residentNav: NavSection[] = [
  { title: "Home", items: [{ label: "Home", href: "/", icon: Home }] },
  { title: "Daily", items: [
    { label: "Visitors", href: "/visitors", icon: Users },
    { label: "Deliveries", href: "/deliveries", icon: Truck },
    { label: "Domestic Help", href: "/help", icon: HeartHandshake },
    { label: "Vehicles", href: "/vehicles", icon: Car },
  ]},
  { title: "Society", items: [
    { label: "Parking", href: "/parking", icon: SquareParking },
    { label: "Amenities", href: "/amenities", icon: Calendar },
    { label: "Bookings", href: "/bookings", icon: Calendar },
    { label: "Bills", href: "/bills", icon: Wallet },
    { label: "Helpdesk", href: "/helpdesk", icon: Wrench },
  ]},
  { title: "Community", items: [
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Polls", href: "/community/polls", icon: Vote },
    { label: "Events", href: "/events", icon: Calendar },
    { label: "Emergency", href: "/emergency", icon: Siren },
    { label: "Notifications", href: "/notifications", icon: Bell },
  ]},
  { title: "You", items: [
    { label: "Profile", href: "/profile", icon: User },
  ]},
];

export const guardNav: NavSection[] = [
  { title: "Gate", items: [
    { label: "Gate Console", href: "/guard", icon: Shield },
    { label: "Emergency", href: "/emergency", icon: Siren },
  ]},
  { title: "Operations", items: [
    { label: "Visitors", href: "/guard", icon: Users },
    { label: "Deliveries", href: "/guard", icon: Truck },
    { label: "Vehicles", href: "/guard", icon: Car },
    { label: "Domestic Help", href: "/guard", icon: HeartHandshake },
  ]},
];

export const adminNav: NavSection[] = [
  { title: "Overview", items: [{ label: "Overview", href: "/admin", icon: BarChart3 }] },
  { title: "Manage", items: [
    { label: "Residents", href: "/admin/residents", icon: Users },
    { label: "Units", href: "/admin/units", icon: Building2 },
    { label: "Gates", href: "/admin/gates", icon: Shield },
    { label: "Parking", href: "/admin/parking", icon: SquareParking },
    { label: "Amenities", href: "/admin/amenities", icon: Calendar },
  ]},
  { title: "Operations", items: [
    { label: "Visitors", href: "/admin/visitors", icon: Users },
    { label: "Deliveries", href: "/admin/deliveries", icon: Truck },
    { label: "Domestic Help", href: "/admin/help", icon: HeartHandshake },
    { label: "Vehicles", href: "/admin/vehicles", icon: Car },
    { label: "Bookings", href: "/admin/bookings", icon: ClipboardList },
    { label: "Bills", href: "/admin/bills", icon: CreditCard },
    { label: "Payments", href: "/admin/payments", icon: Wallet },
    { label: "Helpdesk", href: "/admin/helpdesk", icon: Wrench },
  ]},
  { title: "Engage", items: [
    { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { label: "Polls", href: "/admin/polls", icon: Vote },
    { label: "Events", href: "/admin/events", icon: Calendar },
    { label: "Emergency", href: "/admin/emergency", icon: Siren },
    { label: "Community", href: "/admin/community", icon: Vote },
  ]},
  { title: "Reports", items: [
    { label: "Finance", href: "/admin/reports/finance", icon: Wallet },
    { label: "Security", href: "/admin/reports/security", icon: Shield },
    { label: "Amenities", href: "/admin/reports/amenities", icon: Calendar },
    { label: "Community", href: "/admin/reports/community", icon: BarChart3 },
  ]},
  { title: "Audit", items: [
    { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
  ]},
];

export function getNavForRoles(roles: string[], activeMode?: "RESIDENT" | "GUARD" | "ADMIN" | null) {
  if (activeMode === "GUARD") return guardNav;
  if (activeMode === "ADMIN") return adminNav;
  if (activeMode === "RESIDENT") return residentNav;
  if (roles.includes("GUARD") || roles.includes("SECURITY_MANAGER")) return guardNav;
  if (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("SOCIETY_ADMIN") ||
    roles.includes("RWA_MEMBER") ||
    roles.includes("ACCOUNTANT") ||
    roles.includes("FACILITY_MANAGER")
  ) {
    return adminNav;
  }
  return residentNav;
}

export const bottomNavItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Polls", href: "/community/polls", icon: Vote },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Notifications", href: "/notifications", icon: Bell },
];
