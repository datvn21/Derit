import * as React from "react";
import { FileCode2 } from "lucide-react";
import { cn } from "~/lib/utils";

export interface FileIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  name?: string;
  language?: string;
  className?: string;
}

/**
 * Returns the corresponding language icon asset from /Lang/*.svg
 * or undefined for unknown file types.
 */
export function getLanguageIconSrc(name?: string, language?: string): string | null {
  const langKey = language?.toLowerCase().trim();
  if (langKey === "java") return "/Lang/java.svg";
  if (langKey === "python" || langKey === "py") return "/Lang/python.svg";
  if (langKey === "cpp" || langKey === "c++" || langKey === "c") return "/Lang/c-plusplus.svg";

  if (!name) return null;

  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "java":
      return "/Lang/java.svg";
    case "py":
    case "python":
      return "/Lang/python.svg";
    case "cpp":
    case "cc":
    case "cxx":
    case "c":
    case "h":
    case "hpp":
      return "/Lang/c-plusplus.svg";
    default:
      return null;
  }
}

/**
 * Single source of truth for language / file icons across Derit.
 * Uses SVGs from /Lang/ with fallback to FileCode2.
 */
export function FileIcon({
  name,
  language,
  className = "w-4 h-4 shrink-0 inline-block object-contain",
  alt,
  ...props
}: FileIconProps) {
  const iconSrc = getLanguageIconSrc(name, language);

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={alt || name || language || "File icon"}
        className={cn("w-4 h-4 shrink-0 inline-block object-contain select-none", className)}
        loading="lazy"
        {...props}
      />
    );
  }

  return <FileCode2 className={cn("w-4 h-4 shrink-0 text-muted-foreground", className)} />;
}
