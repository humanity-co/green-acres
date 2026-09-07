import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: string;
}) {
  return (
    <Card className="border border-border/80 bg-card hover:border-border transition-colors duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground/90">{sub}</p>}
          </div>
          {icon && (
            <div className="h-8 w-8 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground shrink-0 border border-border/40">
              {icon}
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{trend}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
