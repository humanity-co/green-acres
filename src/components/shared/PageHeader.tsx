import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/70 pb-5 mb-6">
      <div className="space-y-1.5 min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">{eyebrow}</p>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground/90 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 mb-2">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground/90 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}
