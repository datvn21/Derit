/**
 * `Logo` - single source of truth for the Derit wordmark/lockup.
 *
 * Three locked sizes (`sm | md | lg`) align to the brand-mark grid:
 *   - sm (h-8)  : sidebar / inline
 *   - md (h-10) : exam workspace header
 *   - lg (h-14) : login / onboarding
 *
 * The underlying asset (`~/assets/Logo.png`) keeps its native aspect ratio
 * via `object-contain` so swapping the source image never distorts the
 * brand mark across the app.
 */
import LogoAsset from "~/assets/Logo.png";
import { cn } from "~/lib/utils";

export type LogoSize = "sm" | "md" | "lg";

const sizeMap: Record<LogoSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

export interface LogoProps {
  size?: LogoSize;
  className?: string;
  alt?: string;
}

export default function Logo({
  size = "sm",
  className,
  alt = "Derit",
}: LogoProps) {
  return (
    <img
      src={LogoAsset}
      alt={alt}
      className={cn(sizeMap[size], "object-contain shrink-0", className)}
    />
  );
}
