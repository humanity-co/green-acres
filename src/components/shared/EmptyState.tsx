import Link from "next/link";
import { Button } from "@/components/ui/button";
export function EmptyState({ title, description, actionLabel, onAction, href, icon }: { title: string; description?: string; actionLabel?: string; onAction?: () => void; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      {icon && <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {actionLabel && href ? <Link href={href}><Button size="sm" className="mt-4">{actionLabel}</Button></Link> : actionLabel && onAction ? <Button size="sm" className="mt-4" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
          <div className="h-4 w-1/3 bg-muted rounded" />
          <div className="h-3 w-2/3 bg-muted rounded mt-2" />
        </div>
      ))}
    </div>
  );
}
