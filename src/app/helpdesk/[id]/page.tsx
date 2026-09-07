"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Wrench,
  Clock,
  User,
  MessageSquare,
  Home,
  CheckCircle2,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Send,
  Loader2,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export default function TicketDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog state for Reopen / Cancel
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const load = async () => {
    try {
      const r = await fetch(`/api/helpdesk/${params.id}`);
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const d = await r.json();
      setData(d);
    } catch {
      toast.error("Failed to load ticket details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const postComment = async (customBody?: string) => {
    const text = customBody || comment;
    if (!text.trim()) return;
    setSubmittingComment(true);
    try {
      const r = await fetch(`/api/helpdesk/${params.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        return toast.error(d.error || "Failed to post comment");
      }
      setComment("");
      toast.success("Comment added");
      await load();
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: string, reasonComment?: string) => {
    setActionLoading(true);
    try {
      const r = await fetch(`/api/helpdesk/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const d = await r.json();
      if (!r.ok) {
        return toast.error(d.error || `Failed to update status to ${newStatus}`);
      }

      if (reasonComment?.trim()) {
        await postComment(reasonComment.trim());
      }

      toast.success(
        newStatus === "CLOSED"
          ? "Ticket confirmed and closed!"
          : newStatus === "OPEN"
          ? "Ticket reopened!"
          : `Status updated to ${newStatus}`
      );
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update ticket");
    } finally {
      setActionLoading(false);
      setCancelOpen(false);
      setReopenOpen(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-40 bg-muted/60 animate-pulse rounded-xl" />
          <div className="h-60 bg-muted/40 animate-pulse rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm font-medium">Ticket not found or unauthorized.</p>
              <Button variant="outline" size="sm" onClick={() => router.push("/helpdesk")}>
                Return to Helpdesk
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const { ticket, comments } = data;

  // SLA Calculation
  let slaBadge = null;
  if (ticket.slaDue) {
    const dueTime = new Date(ticket.slaDue).getTime();
    const now = Date.now();
    const diffHours = Math.round((dueTime - now) / (1000 * 60 * 60));
    const isDone = ["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status);

    if (!isDone) {
      if (diffHours < 0) {
        slaBadge = (
          <Badge variant="destructive" className="text-xs font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> SLA Breached ({Math.abs(diffHours)}h overdue)
          </Badge>
        );
      } else if (diffHours <= 4) {
        slaBadge = (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-xs font-semibold flex items-center gap-1">
            <Clock className="h-3 w-3" /> SLA Urgent ({diffHours}h left)
          </Badge>
        );
      } else {
        slaBadge = (
          <Badge variant="secondary" className="text-xs font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" /> SLA Due in {diffHours}h
          </Badge>
        );
      }
    }
  }

  const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    OPEN: "default",
    ASSIGNED: "secondary",
    IN_PROGRESS: "secondary",
    RESOLVED: "default",
    CLOSED: "outline",
    CANCELLED: "destructive",
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push("/helpdesk")} className="text-xs">
            ← Back to Helpdesk
          </Button>
          <span className="text-xs font-mono text-muted-foreground">
            Ticket #{ticket.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Resident Action Prompt if Resolved */}
        {ticket.status === "RESOLVED" && (
          <Card className="border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20 dark:border-emerald-900 shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Work Reported as Completed</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Please verify the fix. Accept to close or reopen if further attention is needed.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReopenOpen(true)}
                  disabled={actionLoading}
                  className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reopen
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("CLOSED")}
                  disabled={actionLoading}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Accept & Close
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Ticket Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary shrink-0" />
                  <span>{ticket.title}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Category: <span className="font-medium text-foreground">{ticket.category}</span> • Priority:{" "}
                  <span className="font-medium text-foreground">{ticket.priority}</span>
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {slaBadge}
                <Badge variant={statusVariantMap[ticket.status] || "secondary"} className="text-xs font-semibold uppercase">
                  {ticket.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Description */}
            <div className="bg-muted/30 p-3.5 rounded-lg border border-border/60 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
              {ticket.description || "No description provided."}
            </div>

            {/* Metadata Grid (Unit, Raised By, Technician) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-border/60">
              {/* Unit Info */}
              <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/20">
                <Home className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[11px] font-medium">Flat / Unit</p>
                  <p className="font-semibold truncate">
                    Unit {ticket.unit?.number || ticket.unitId.slice(0, 6)}
                  </p>
                  {ticket.unit?.buildingName && (
                    <p className="text-[11px] text-muted-foreground truncate">{ticket.unit.buildingName}</p>
                  )}
                </div>
              </div>

              {/* Raised By */}
              <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/20">
                <User className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[11px] font-medium">Reported By</p>
                  <p className="font-semibold truncate">
                    {ticket.author?.fullName || "Resident"}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Assigned Technician */}
              <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/20">
                <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[11px] font-medium">Assigned Staff</p>
                  {ticket.assignee ? (
                    <>
                      <p className="font-semibold truncate text-foreground">{ticket.assignee.fullName}</p>
                      {ticket.assignee.phone && (
                        <p className="text-[11px] text-primary flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {ticket.assignee.phone}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">Pending Dispatch</p>
                  )}
                </div>
              </div>
            </div>

            {/* Resident Actions (Cancel if Open/Assigned) */}
            {["OPEN", "ASSIGNED"].includes(ticket.status) && (
              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelOpen(true)}
                  disabled={actionLoading}
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancel Ticket
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discussion & Activity Timeline */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>Activity & Discussion Timeline</span>
              <Badge variant="outline" className="text-[10px] ml-auto font-normal">
                {comments.length} updates
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No discussion or updates on this ticket yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {comments.map((c: any) => {
                  const isActivity = c.body.startsWith("[Activity]");
                  if (isActivity) {
                    const activityText = c.body.replace("[Activity]", "").trim();
                    return (
                      <div
                        key={c.id}
                        className="py-1.5 px-3 rounded-md bg-muted/40 border border-border/40 text-xs text-muted-foreground flex items-center gap-2"
                      >
                        <Clock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        <span className="flex-1 font-mono text-[11px]">{activityText}</span>
                        <span className="text-[10px] shrink-0 text-muted-foreground/60">
                          {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  }

                  const authorName = c.author?.fullName || "User";
                  const authorRole = c.author?.role || "MEMBER";

                  return (
                    <div
                      key={c.id}
                      className="rounded-lg border border-border/70 p-3 space-y-1.5 bg-card hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center uppercase">
                            {authorName.slice(0, 2)}
                          </div>
                          <span className="text-xs font-semibold text-foreground">{authorName}</span>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 uppercase">
                            {authorRole.replace("_", " ")}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap pl-8">
                        {c.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Comment Box */}
            {!["CLOSED", "CANCELLED"].includes(ticket.status) ? (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Post a message, update, or note for facility staff..."
                  rows={3}
                  maxLength={2000}
                  className="text-xs resize-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      postComment();
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Press Ctrl+Enter to post</span>
                  <Button
                    size="sm"
                    onClick={() => postComment()}
                    disabled={submittingComment || !comment.trim()}
                    className="h-8 px-3 text-xs font-medium"
                  >
                    {submittingComment ? (
                      <>
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-1.5 h-3 w-3" />
                        Post Message
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 text-center text-xs text-muted-foreground bg-muted/20 rounded-md">
                This ticket is {ticket.status.toLowerCase()} and closed to new comments.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Ticket Confirmation Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Cancel Complaint Ticket?</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to cancel this complaint? Facility staff will be notified that the issue is no longer active.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)} className="text-xs">
              Keep Active
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading}
              onClick={() => handleStatusChange("CANCELLED", "Resident cancelled the ticket.")}
              className="text-xs"
            >
              {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Ticket Dialog */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Reopen Complaint Ticket</DialogTitle>
            <DialogDescription className="text-xs">
              Please share what remains unaddressed or why the issue persists so technicians can follow up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. The leak resumed this morning after water supply turned on..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setReopenOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionLoading || !reopenReason.trim()}
              onClick={() =>
                handleStatusChange("OPEN", `[Reopened by Resident] Reason: ${reopenReason.trim()}`)
              }
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              {actionLoading ? "Reopening..." : "Reopen Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
