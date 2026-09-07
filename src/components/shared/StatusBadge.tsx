export function StatusBadge({ status }: { status: string }) {
  const dotColor: Record<string, string> = {
    PAID: "bg-emerald-500",
    SUCCESS: "bg-emerald-500",
    COLLECTED: "bg-emerald-500",
    CONFIRMED: "bg-emerald-500",
    CHECKED_OUT: "bg-emerald-500",
    RESOLVED: "bg-emerald-500",
    APPROVED: "bg-emerald-500",
    CLOSED: "bg-emerald-500",

    PENDING: "bg-amber-500",
    PENDING_PAYMENT: "bg-amber-500",
    AT_GATE: "bg-amber-500",
    ASSIGNED: "bg-amber-500",
    PARTIAL: "bg-amber-500",
    ACKNOWLEDGED: "bg-amber-500",
    REFUNDED: "bg-purple-500",

    OVERDUE: "bg-red-500",
    REJECTED: "bg-red-500",
    CANCELLED: "bg-red-500",
    EXPIRED: "bg-red-500",
    RETURNED: "bg-red-500",
    FAILED: "bg-red-500",

    OPEN: "bg-sky-500",
    IN_PROGRESS: "bg-sky-500",
    ISSUED: "bg-sky-500",
    DELIVERED: "bg-sky-500",
    CHECKED_IN: "bg-sky-500",
  };

  const dot = dotColor[status] || "bg-zinc-400";
  const label = status.replace(/_/g, " ");

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase font-mono tabular-nums border border-border/70 bg-card/80 text-foreground/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
      <span>{label}</span>
    </span>
  );
}
