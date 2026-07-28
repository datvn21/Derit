import { File } from "lucide-react";

/**
 * Per-extension icon shown in the file explorer and editor header.
 * Renders the Java coffee-cup image, an inline Python SVG, or a generic
 * file icon for everything else.
 */
export function FileIcon({
  name,
  className = "w-4 h-4 shrink-0",
}: {
  name: string;
  className?: string;
}) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "java") {
    return <img src="/java.png" alt="Java" className={className} />;
  }
  if (ext === "py") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        aria-label="Python file"
        fill="currentColor"
      >
        <path
          d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.887S0 5.789 0 11.969c0 6.18 3.403 5.963 3.403 5.963h2.031v-2.867s-.109-3.402 3.35-3.402h5.769s3.24.052 3.24-3.131V3.19S18.28 0 11.914 0zm-3.21 1.839a1.047 1.047 0 1 1 0 2.094 1.047 1.047 0 0 1 0-2.094z"
          style={{ fill: "#3572A5" }}
        />
        <path
          d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.113S24 18.211 24 12.031c0-6.18-3.403-5.963-3.403-5.963h-2.031v2.867s.109 3.402-3.35 3.402H9.447s-3.24-.052-3.24 3.131v5.312S5.72 24 12.086 24zm3.21-1.839a1.047 1.047 0 1 1 0-2.094 1.047 1.047 0 0 1 0 2.094z"
          style={{ fill: "#FFD43B" }}
        />
      </svg>
    );
  }
  return <File className={className} />;
}