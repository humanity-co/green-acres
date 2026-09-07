"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import { Bell, CheckCheck, Clock } from "lucide-react";
import { toast } from "sonner";
function relatedHref(n: any) {
  if (!n.relatedEntity || !n.relatedId) return null;
  const m: Record<string, string> = {
    announcement: `/announcements/${n.relatedId}`,
    bill: `/bills/${n.relatedId}`,
    payment: `/bills/${n.relatedId}`,
    booking: `/bookings/${n.relatedId}`,
    poll: `/community/polls/${n.relatedId}`,
    event: `/events/${n.relatedId}`,
    delivery: `/deliveries/${n.relatedId}`,
    ticket: `/helpdesk/${n.relatedId}`,
    helpdesk: `/helpdesk/${n.relatedId}`,
    emergency: `/emergency`,
    vehicle: `/vehicles/${n.relatedId}`,
    parking: `/parking`,
    help: `/help/${n.relatedId}`,
    visitor: `/visitors/${n.relatedId}`,
    invite: `/visitors/${n.relatedId}`,
  };
  return m[n.relatedEntity] || null;
}
export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);
  const unread = items.filter((n) => !n.readAt).length;
  async function markOne(id: string) {
    const r = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    if (r.ok) setItems((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  }
  async function markAll() {
    const r = await fetch("/api/notifications/read-all", { method: "POST" });
    if (r.ok) { toast.success("All marked read"); setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))); }
  }
  if (loading) return <AppShell><div className="max-w-3xl mx-auto"><LoadingSkeleton rows={5} /></div></AppShell>;
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Notifications" description={`${unread} unread • newest first`} />
        <div className="flex justify-between items-center">
          <Badge variant={unread ? "default" : "secondary"}>{unread} unread</Badge>
          <Button size="sm" variant="outline" onClick={markAll} disabled={unread === 0}><CheckCheck className="h-4 w-4 mr-1" />Mark all read</Button>
        </div>
        {items.length === 0 ? <EmptyState icon={<Bell className="h-5 w-5" />} title="No notifications" description="You're all caught up." /> : (
          <div className="space-y-2">
            {items.map((n) => {
              const href = relatedHref(n);
              const Wrapper = href ? Link : "div" as any;
              const props = href ? { href } : {};
              return (
                <Wrapper key={n.id} {...props}>
                  <Card className={`${!n.readAt ? "border-l-4 border-l-primary bg-muted/20" : ""} hover:bg-muted/30`} >
                    <CardContent className="p-3 flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {!n.readAt ? <Badge className="text-xs">New</Badge> : <Badge variant="outline" className="text-xs">Read</Badge>}
                        {!n.readAt && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markOne(n.id); }}>Mark read</Button>}
                      </div>
                    </CardContent>
                  </Card>
                </Wrapper>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
