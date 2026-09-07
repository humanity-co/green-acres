import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";

type Props = {
  href?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  categoryBadge?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
};

export function ListCard({ href, title, subtitle, meta, status, categoryBadge, leading, trailing, children }: Props) {
  const content = (
    <Card className="hover:bg-muted/30">
      <CardContent className="p-4">
        <div className="flex justify-between gap-3">
          <div className="flex gap-3 min-w-0 flex-1">
            {leading && <div className="shrink-0">{leading}</div>}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
              {meta && <p className="text-xs text-muted-foreground mt-1 truncate">{meta}</p>}
              {children}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {status && <StatusBadge status={status} />}
            {categoryBadge && <Badge variant="outline" className="text-xs">{categoryBadge}</Badge>}
            {trailing}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{content}</Link>;
  return content;
}
