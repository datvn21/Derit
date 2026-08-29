/**
 * `PageLoading` - single full-page loading state used by every route that
 * gates on auth or initial data fetch. Lives at `ui/` so the design system
 * stays the single source of truth for spinner visuals.
 *
 * Usage:
 *   - Route-level fallback while `useAuth` resolves.
 *   - Mid-page fallback while a query is pending (rare - prefer skeleton).
 *
 * Tokens: `bg-muted` for the spinner ring, `border-t-primary` for the
 * accent sweep, `text-muted-foreground` for the helper label.
 */
import { cn } from "~/lib/utils";

export interface PageLoadingProps {
  label?: string;
  /** "page" centers within the full viewport; "section" centers within min-h-[50vh]. */
  scope?: "page" | "section";
  className?: string;
}

export function PageLoading({
  label,
  scope = "page",
  className,
}: PageLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        scope === "page" ? "min-h-screen" : "min-h-[50vh]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
