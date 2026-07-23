/**
 * StatCard — a small KPI tile used on lecturer/admin dashboards.
 *
 * Monochrome by design (see audit C1): a single accent-tinted icon chip
 * and one optional status badge. Status differentiation is carried by the
 * `Badge` primitive, not by a multi-hue icon background.
 */
import { type ComponentType, type SVGProps } from "react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type StatCardVariant = "default" | "muted";

export interface StatCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number | string;
  badge?: string;
  hint?: string;
  variant?: StatCardVariant;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  badge,
  hint,
  variant = "default",
  ctaLabel,
  ctaHref,
  className,
}: StatCardProps) {
  const isMuted = variant === "muted";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-6",
        "transition-[border-color] duration-(--motion-fast) ease-(--motion-ease)",
        isMuted
          ? "border-border hover:border-muted-foreground/40"
          : "border-border hover:border-foreground/20",
        className,
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className={cn(
            "p-2 rounded-lg",
            isMuted ? "bg-muted" : "bg-accent",
          )}
        >
          <Icon
            className={cn(
              "w-6 h-6",
              isMuted ? "text-muted-foreground" : "text-accent-foreground",
            )}
            aria-hidden
          />
        </div>
        {badge && <Badge>{badge}</Badge>}
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-bold text-foreground tracking-tight">
          {value}
        </h3>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>
      {(hint || (ctaLabel && ctaHref)) && (
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3">
          {hint && (
            <span className="text-xs text-muted-foreground">{hint}</span>
          )}
          {ctaLabel && ctaHref && (
            <Link
              to={ctaHref}
              className="text-sm font-medium text-primary hover:text-primary-hover flex items-center gap-1 group"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
