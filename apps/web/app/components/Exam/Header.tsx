import { useState, useEffect } from "react";
import { Clock, User, Hash, Monitor } from "lucide-react";
import { Button } from "~/components/ui/button";
import Logo from "~/components/Logo";

interface ExamHeaderProps {
  examName: string;
  studentName: string;
  studentId?: string;
  computerOrder?: string | number;
  examCode: string;
  /**
   * Milliseconds remaining at the moment this component mounts, derived
   * purely from server-provided times (endTime − serverTime).
   * The ticker uses performance.now() so it is completely immune to any
   * subsequent changes the user makes to their system clock.
   */
  initialRemainingMs: number;
  onSubmit: () => void;
  onExit: () => void;
}

export default function ExamHeader({
  examName,
  studentName,
  studentId,
  computerOrder,
  examCode,
  initialRemainingMs,
  onSubmit,
  onExit,
}: ExamHeaderProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    // performance.now() is a monotonic high-resolution timer that starts at
    // page-load and always advances in real wall-time seconds, regardless of
    // any system clock adjustments. Storing the mount instant here means every
    // subsequent tick computes: remaining = initialRemainingMs − elapsedSinceMounted
    // which is 100% independent of the user's local clock.
    const mountedAt = performance.now();

    const compute = () => {
      const elapsed = performance.now() - mountedAt;
      const diff = Math.floor(initialRemainingMs - elapsed);

      if (diff <= 0) {
        setTimeRemaining("00:00:00");
        onSubmit();
        return false;
      }

      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);

      setIsWarning(diff <= 5 * 60_000);
      setIsCritical(diff <= 60_000);
      setTimeRemaining(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
      return true;
    };

    if (!compute()) return;
    const timer = setInterval(() => {
      if (!compute()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [initialRemainingMs, onSubmit]);

  return (
    <header className="bg-background border-b border-border z-10">
      <div className="px-5 h-14 flex items-center justify-between gap-4">
        {/* ── Left: brand + exam info ── */}
        <div className="flex items-center gap-3 min-w-0 flex-1 basis-0">
          <Logo size="sm" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate leading-tight">
              {examName}
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                {studentName}
              </span>
              {studentId && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Hash className="w-3 h-3" />
                  {studentId}
                </span>
              )}
              {computerOrder != null && computerOrder !== "" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Monitor className="w-3 h-3" />
                  PC {computerOrder}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Center: countdown ── */}
        <div
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold text-sm 
            transition-colors shrink-0
            ${
              isCritical
                ? "bg-red-600 text-white animate-pulse"
                : isWarning
                  ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                  : " text-black"
            }`}
        >
          <span className="tabular-nums text-lg tracking-wider">
            {timeRemaining}
          </span>
        </div>

        {/* ── Right: actions ── */}
        <div className="flex items-center gap-2 shrink-0 flex-1 basis-0 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="h-8 bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 cursor-pointer"
          >
            Exit
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            className="h-8 bg-primary hover:bg-primary/80 text-white gap-1.5 cursor-pointer"
          >
            Submit
          </Button>
        </div>
      </div>
    </header>
  );
}
