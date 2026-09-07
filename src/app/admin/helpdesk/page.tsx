"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState, LoadingSkeleton } from "@/components/shared/EmptyState";
import {
  Wrench,
  Clock,
  User,
  MessageSquare,
  Home,
  CheckCircle2,
  AlertTriangle,
  Send,
  UserCheck,
  Play,
  XCircle,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminHelpdesk() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "all", priority: "all", category: "all" });
  const [selected, setSelected] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [assignId, setAssignId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Resolve dialog state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.priority !== "all") params.set("priority", filters.priority);
      if (filters.category !== "all") params.set("category", filters.category);
      const r = await fetch(`/api/helpdesk?${params}`);
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {
      toast.error("Failed to load helpdesk tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch("/api/admin/members")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const eligible = d.filter((m: any) =>
            [
              "SOCIETY_ADMIN",
              "RWA_MEMBER",
              "FACILITY_MANAGER",
              "SECURITY_MANAGER",
              "SERVICE_PROVIDER",
              "VENDOR",
            ].includes(m.role)
          );
          setStaff(eligible);
        }
      })
      .catch(() => {});
  }, [filters]);

  const openTicket = async (id: string) => {
    try {
      const r = await fetch(`/api/helpdesk/${id}`);
      const d = await r.json();
      setSelected(d.ticket);
      setComments(d.comments || []);
      setAssignId(d.ticket.assigneeId || "");
    } catch {
      toast.error("Failed to load ticket details");
    }
  };

  const updateStatus = async (status: string, extraNote?: string) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const r = await fetch(`/api/helpdesk/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (!r.ok) return toast.error(d.error || "Failed to update status");

      if (extraNote?.trim()) {
        await fetch(`/api/helpdesk/${selected.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: extraNote.trim() }),
        });
      }

      toast.success(`Status updated to ${status}`);
      // Refresh current ticket
      await openTicket(selected.id);
      await load();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActionLoading(false);
      setResolveDialogOpen(false);
      setResolutionNote("");
    }
  };

  const assign = async () => {
    if (!selected || !assignId) return;
    setActionLoading(true);
    try {
      // If currently OPEN, also transition to ASSIGNED automatically
      const nextStatus = selected.status === "OPEN" ? "ASSIGNED" : undefined;
      const bodyPayload: any = { assigneeId: assignId };
      if (nextStatus) bodyPayload.status = nextStatus;

      const r = await fetch(`/api/helpdesk/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const d = await r.json();
      if (!r.ok) return toast.error(d.error || "Failed to assign staff");

      toast.success("Technician assigned successfully");
      await openTicket(selected.id);
      await load();
    } catch {
      toast.error("Failed to assign staff");
    } finally {
      setActionLoading(false);
    }
  };

  const postComment = async () => {
    if (!selected || !comment.trim()) return;
    try {
      const r = await fetch(`/api/helpdesk/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment.trim() }),
      });
      if (!r.ok) {
        const d = await r.json();
        return toast.error(d.error || "Failed to post reply");
      }
      setComment("");
      toast.success("Reply added");
      const d = await fetch(`/api/helpdesk/${selected.id}`).then((r) => r.json());
      setComments(d.comments || []);
    } catch {
      toast.error("Failed to post comment");
    }
  };

  const counts = {
    open: items.filter((t: any) => t.status === "OPEN").length,
    assigned: items.filter((t: any) => t.status === "ASSIGNED").length,
    inprog: items.filter((t: any) => t.status === "IN_PROGRESS").length,
    resolved: items.filter((t: any) => t.status === "RESOLVED").length,
    closed: items.filter((t: any) => t.status === "CLOSED").length,
    urgent: items.filter((t: any) => ["HIGH", "URGENT"].includes(t.priority)).length,
  };

  const computeSlaStatus = (ticket: any) => {
    if (!ticket.slaDue) return null;
    const due = new Date(ticket.slaDue).getTime();
    const diff = Math.round((due - Date.now()) / (1000 * 60 * 60));
    const isDone = ["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status);
    if (isDone) return null;
    if (diff < 0) {
      return (
        <Badge variant="destructive" className="text-[10px] font-semibold py-0 px-1">
          SLA Breached ({Math.abs(diff)}h)
        </Badge>
      );
    }
    if (diff <= 4) {
      return (
        <Badge className="bg-amber-600 text-white text-[10px] font-medium py-0 px-1">
          SLA Due in {diff}h
        </Badge>
      );
    }
    return (
      <span className="text-[10px] text-muted-foreground">
        SLA in {diff}h
      </span>
    );
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-4">
          <LoadingSkeleton rows={5} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">
        <PageHeader
          title="Helpdesk & Operations"
          description="Tenant-scoped complaint lifecycle • technician dispatch & SLA tracking"
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold">{counts.open}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Open</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold">{counts.assigned}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Assigned</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-sky-600">{counts.inprog}</p>
              <p className="text-[11px] text-muted-foreground font-medium">In Progress</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{counts.resolved}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Resolved</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-muted-foreground">{counts.closed}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Closed</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{counts.urgent}</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">High / Urgent</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card className="shadow-sm">
          <CardContent className="p-3 flex flex-wrap gap-2.5 items-center">
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(v) => setFilters({ ...filters, priority: v })}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Category</SelectItem>
                <SelectItem value="Plumbing">Plumbing</SelectItem>
                <SelectItem value="Electrical">Electrical</SelectItem>
                <SelectItem value="Cleaning">Cleaning</SelectItem>
                <SelectItem value="Security">Security</SelectItem>
                <SelectItem value="Carpentry">Carpentry</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Button size="sm" variant="outline" onClick={load} className="h-8 text-xs ml-auto">
              Refresh
            </Button>
          </CardContent>
        </Card>

        {/* Master-Detail Grid */}
        <div className="grid lg:grid-cols-12 gap-4">
          {/* Left Column: Tickets Queue */}
          <Card className="lg:col-span-5 shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Complaint Queue</span>
                <span>{items.length} records</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y max-h-[68vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="py-12">
                  <EmptyState
                    icon={<Wrench className="h-5 w-5" />}
                    title="No tickets found"
                    description="No tickets match the current filter parameters."
                  />
                </div>
              ) : (
                items.map((t: any) => {
                  const isSelected = selected?.id === t.id;
                  const unitLabel = t.unit?.number
                    ? `Unit ${t.unit.number}${t.unit.buildingName ? ` • ${t.unit.buildingName}` : ""}`
                    : `Unit ${t.unitId.slice(0, 6)}`;
                  const authorLabel = t.author?.fullName || "Resident";

                  return (
                    <button
                      key={t.id}
                      onClick={() => openTicket(t.id)}
                      className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-primary/5 border-l-4 border-primary"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                        <Badge
                          variant={t.status === "OPEN" ? "destructive" : "secondary"}
                          className="text-[10px] uppercase font-semibold shrink-0"
                        >
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                        <Home className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-foreground truncate">{unitLabel}</span>
                        <span>•</span>
                        <span className="truncate">{authorLabel}</span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[11px]">
                        <span className="text-muted-foreground">
                          {t.category} • <span className="font-medium">{t.priority}</span>
                        </span>
                        {computeSlaStatus(t)}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Right Column: Active Ticket Workspace */}
          <div className="lg:col-span-7 space-y-4">
            {!selected ? (
              <Card className="shadow-sm h-full min-h-[300px] flex items-center justify-center">
                <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                  <Wrench className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-medium">Select a ticket from the queue to view details & dispatch</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Operations Control Card */}
                <Card className="border-border shadow-sm">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{selected.id.slice(0, 8).toUpperCase()}
                          </Badge>
                          <Badge className="text-[10px] uppercase font-semibold">
                            {selected.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {selected.priority}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-bold flex items-center gap-2 mt-1">
                          <Wrench className="h-4 w-4 text-primary" />
                          <span>{selected.title}</span>
                        </CardTitle>
                      </div>

                      {computeSlaStatus(selected)}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    {/* Description */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/60 text-xs leading-relaxed whitespace-pre-wrap">
                      {selected.description || "No description provided."}
                    </div>

                    {/* Flat & Resident Details Strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3 rounded-lg bg-muted/15 border border-border/60">
                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Location & Flat</p>
                        <p className="font-semibold text-foreground">
                          Unit {selected.unit?.number || selected.unitId.slice(0, 6)}
                        </p>
                        {selected.unit?.buildingName && (
                          <p className="text-[11px] text-muted-foreground">{selected.unit.buildingName}</p>
                        )}
                      </div>

                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Resident Details</p>
                        <p className="font-semibold text-foreground">
                          {selected.author?.fullName || "Resident"}
                        </p>
                        {selected.author?.phone && (
                          <p className="text-[11px] text-primary flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {selected.author.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Technician Dispatch Section */}
                    <div className="p-3 rounded-lg border border-border/80 bg-background space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                          Technician / Staff Assignment
                        </span>
                        {selected.assignee && (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            Currently assigned: {selected.assignee.fullName}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Select value={assignId} onValueChange={setAssignId}>
                          <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue placeholder="Select technician / staff member" />
                          </SelectTrigger>
                          <SelectContent>
                            {staff.map((s: any) => (
                              <SelectItem key={s.user.id} value={s.user.id} className="text-xs">
                                {s.user.fullName} • {s.role.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          onClick={assign}
                          disabled={actionLoading || !assignId || assignId === selected.assigneeId}
                          className="h-8 px-3 text-xs"
                        >
                          {selected.status === "OPEN" ? "Assign & Dispatch" : "Reassign"}
                        </Button>
                      </div>
                    </div>

                    {/* Status Lifecycle Controls */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Progress Lifecycle
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selected.status === "ASSIGNED" && (
                          <Button
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => updateStatus("IN_PROGRESS")}
                            className="text-xs h-8 bg-sky-600 hover:bg-sky-700 text-white"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start Work → IN_PROGRESS
                          </Button>
                        )}

                        {["ASSIGNED", "IN_PROGRESS"].includes(selected.status) && (
                          <Button
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => setResolveDialogOpen(true)}
                            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark Resolved → RESOLVED
                          </Button>
                        )}

                        {selected.status === "RESOLVED" && (
                          <Button
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => updateStatus("CLOSED")}
                            className="text-xs h-8 bg-slate-800 hover:bg-slate-900 text-white"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Sign Off & Close → CLOSED
                          </Button>
                        )}

                        {!["CLOSED", "CANCELLED"].includes(selected.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoading}
                            onClick={() => updateStatus("CANCELLED")}
                            className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Internal Communication & Timeline */}
                <Card className="shadow-sm">
                  <CardHeader className="py-2.5 px-4 border-b">
                    <CardTitle className="text-xs font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        Activity & Discussion Timeline
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {comments.length} updates
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                      {comments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No messages or activity logged yet.
                        </p>
                      ) : (
                        comments.map((c: any) => {
                          const isActivity = c.body.startsWith("[Activity]");
                          if (isActivity) {
                            return (
                              <div
                                key={c.id}
                                className="py-1 px-2.5 rounded bg-muted/40 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5 font-mono"
                              >
                                <Clock className="h-3 w-3 shrink-0" />
                                <span className="flex-1 truncate">{c.body.replace("[Activity]", "").trim()}</span>
                                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                  {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            );
                          }

                          const authorName = c.author?.fullName || "User";
                          const authorRole = c.author?.role || "STAFF";

                          return (
                            <div key={c.id} className="rounded-lg border p-2.5 bg-muted/10 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-foreground">{authorName}</span>
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 uppercase">
                                    {authorRole.replace("_", " ")}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-foreground/90 whitespace-pre-wrap">{c.body}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Staff Reply Box */}
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Reply to resident or record maintenance update..."
                        rows={2}
                        maxLength={2000}
                        className="text-xs resize-none"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={postComment}
                          disabled={!comment.trim()}
                          className="h-7 px-3 text-xs"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send Update
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Resolution Notes Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Mark Complaint as Resolved</DialogTitle>
            <DialogDescription className="text-xs">
              Provide a brief note explaining the actions taken by the technician or facility staff so the resident can inspect and sign off.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Replaced faulty drain gasket and tested pressure for 15 minutes. All clear."
              rows={3}
              className="text-xs resize-none"
            />
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResolveDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={() =>
                updateStatus(
                  "RESOLVED",
                  resolutionNote.trim() ? `[Resolution Note] ${resolutionNote.trim()}` : undefined
                )
              }
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {actionLoading ? "Resolving..." : "Confirm Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
