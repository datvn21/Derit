import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  EyeOff,
  Loader2,
  Play,
  ChevronRight,
  Timer,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export interface TestCase {
  id: number;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  errorMessage?: string;
  status?: "passed" | "failed" | "error" | "pending";
  executionTime?: number;
  isHidden?: boolean;
  hasTestFile?: boolean;
}

interface TestCasesProps {
  testCases: TestCase[];
  isRunning?: boolean;
  runningTestCaseIdx?: number | null;
  questionNumber?: number;
  onRunTestCase?: (testCaseIdx: number) => void;
  /** Fires the "run all" action - if provided, a Run-all button appears in the header. */
  onRunAll?: () => void;
  /** Disable the Run-all button (e.g. during cooldown). */
  isRunAllDisabled?: boolean;
}

const STATUS_CONFIG = {
  passed: {
    icon: CheckCircle2,
    badgeVariant: "success" as const,
    label: "Passed",
  },
  failed: {
    icon: XCircle,
    badgeVariant: "destructive" as const,
    label: "Failed",
  },
  error: {
    icon: AlertCircle,
    badgeVariant: "destructive" as const,
    label: "Error",
  },
  pending: {
    icon: Clock,
    badgeVariant: "default" as const,
    label: "Pending",
  },
};

function formatMs(ms?: number) {
  if (ms == null) return null;
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export default function TestCases({
  testCases,
  isRunning = false,
  runningTestCaseIdx = null,
  questionNumber,
  onRunTestCase,
  onRunAll,
  isRunAllDisabled = false,
}: TestCasesProps) {
  const visibleTestCases = testCases.filter((tc) => !tc.isHidden);
  const hiddenCount = testCases.filter((tc) => tc.isHidden).length;

  const passedCount = visibleTestCases.filter(
    (tc) => tc.status === "passed",
  ).length;
  const failedCount = visibleTestCases.filter(
    (tc) => tc.status === "failed" || tc.status === "error",
  ).length;
  const pendingCount = visibleTestCases.length - passedCount - failedCount;
  const totalCount = visibleTestCases.length;
  const hasResults = visibleTestCases.some(
    (tc) => tc.status && tc.status !== "pending",
  );

  const questionLabel =
    questionNumber != null ? `Question ${questionNumber}` : null;

  // Default: open the row that is currently running, fail/error rows, or first row.
  const initiallyOpen = new Set<number>(
    visibleTestCases
      .map((tc, i) =>
        tc.status === "failed" ||
        tc.status === "error" ||
        runningTestCaseIdx === i
          ? i
          : null,
      )
      .filter((v): v is number => v !== null),
  );
  if (initiallyOpen.size === 0 && visibleTestCases.length > 0) {
    initiallyOpen.add(0);
  }
  const [openIndices, setOpenIndices] = useState<Set<number>>(initiallyOpen);

  const toggle = (i: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 h-10 px-4 bg-muted border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground tracking-tight truncate">
            Test Cases
          </span>
          {questionLabel && <Badge variant="info">{questionLabel}</Badge>}
        </div>

        {hasResults && totalCount > 0 && (
          <div
            aria-label="Test result summary"
            className="flex items-center gap-3 min-w-0"
          >
            <SummaryStat label="Passed" value={passedCount} variant="success" />
            <span className="text-border" aria-hidden>
              ·
            </span>
            <SummaryStat
              label="Failed"
              value={failedCount}
              variant="destructive"
            />
            <span className="text-border" aria-hidden>
              ·
            </span>
            <SummaryStat
              label="Pending"
              value={pendingCount}
              variant="default"
            />
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {onRunAll && (
            <Button
              type="button"
              onClick={onRunAll}
              disabled={isRunning || isRunAllDisabled}
              size="sm"
              aria-label="Run all test cases"
              title="Run all test cases"
              className="h-7 px-2.5 gap-1"
            >
              {isRunning && runningTestCaseIdx == null ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              Run all
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        {isRunning && runningTestCaseIdx == null ? (
          <EmptyState
            icon={<Loader2 className="w-8 h-8 animate-spin text-primary" />}
            title="Running tests…"
            subtitle={questionLabel ? `for ${questionLabel}` : undefined}
          />
        ) : testCases.length === 0 ? (
          <EmptyState
            icon={<AlertCircle className="w-10 h-10" />}
            title="No test case"
          />
        ) : visibleTestCases.length === 0 ? (
          <EmptyState
            icon={<EyeOff className="w-10 h-10" />}
            title="All test cases are hidden"
            subtitle="Only the grader can see hidden inputs"
          />
        ) : (
          <ul role="list" className="divide-y divide-border">
            {visibleTestCases.map((tc, index) => {
              const cfg = STATUS_CONFIG[tc.status ?? "pending"];
              const Icon = cfg.icon;
              const isOpen = openIndices.has(index);
              const tcIdx = tc.id - 1;
              const isThisRunning = runningTestCaseIdx === tcIdx;
              const execMs = formatMs(tc.executionTime);

              return (
                <li key={tc.id} className="bg-card">
                  {/* ── Row head (always visible) ── */}
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    aria-expanded={isOpen}
                    aria-controls={`tc-panel-${tc.id}`}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors duration-(--motion-fast) ease-(--motion-ease)"
                  >
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-(--motion-fast) ease-(--motion-ease) ${
                        isOpen ? "rotate-90" : ""
                      }`}
                      aria-hidden
                    />

                    <span className="text-xs font-semibold text-muted-foreground tabular-nums shrink-0 w-12">
                      #{index + 1}
                    </span>

                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        tc.status === "passed"
                          ? "text-success"
                          : tc.status === "failed" || tc.status === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                      aria-hidden
                    />

                    <Badge variant={cfg.badgeVariant} className="shrink-0">
                      {isThisRunning ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Running
                        </>
                      ) : (
                        cfg.label
                      )}
                    </Badge>

                    {execMs && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Timer className="w-3 h-3" aria-hidden />
                        {execMs}
                      </span>
                    )}

                    {tc.hasTestFile && onRunTestCase && (
                      <span
                        role="button"
                        tabIndex={isRunning || isThisRunning ? -1 : 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isRunning && !isThisRunning)
                            onRunTestCase(tcIdx);
                        }}
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" || e.key === " ") &&
                            !isRunning &&
                            !isThisRunning
                          ) {
                            e.preventDefault();
                            e.stopPropagation();
                            onRunTestCase(tcIdx);
                          }
                        }}
                        disabled={isRunning || isThisRunning}
                        title="Run this test case"
                        aria-label={`Run test case ${index + 1}`}
                        className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer btn-press"
                      >
                        {isThisRunning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-primary-foreground" />
                        )}
                      </span>
                    )}
                  </button>

                  {/* ── Collapsible detail panel ── */}
                  {isOpen && (
                    <div
                      id={`tc-panel-${tc.id}`}
                      className="px-4 pb-3 pt-1 space-y-1.5 bg-muted/40 border-t border-border"
                    >
                      {tc.isHidden ? (
                        <p className="text-xs text-muted-foreground italic inline-flex items-center gap-1.5">
                          <EyeOff className="w-3 h-3" aria-hidden />
                          Hidden input &amp; expected output - only the grader
                          sees them.
                        </p>
                      ) : (
                        <>
                          <IoRow
                            label="Input"
                            value={tc.input}
                            tone="default"
                          />
                          <IoRow
                            label="Expected"
                            value={tc.expectedOutput}
                            tone="default"
                          />
                        </>
                      )}

                      {(tc.actualOutput !== undefined || tc.errorMessage) && (
                        <IoRow
                          label="Output"
                          value={
                            tc.status === "error"
                              ? tc.errorMessage ||
                                tc.actualOutput ||
                                "(build failed)"
                              : tc.actualOutput || "(wrong)"
                          }
                          tone={
                            tc.status === "passed" ? "success" : "destructive"
                          }
                        />
                      )}

                      {tc.status === "pending" &&
                        tc.actualOutput === undefined &&
                        !tc.errorMessage && (
                          <p className="text-xs text-muted-foreground pt-1">
                            Click <Play className="inline w-3 h-3 mx-0.5" /> on
                            a test case to run it, or hit{" "}
                            <kbd className="px-1 py-0.5 rounded border border-border bg-card text-[10px] font-mono">
                              Run
                            </kbd>{" "}
                            above to run all.
                          </p>
                        )}
                    </div>
                  )}
                </li>
              );
            })}

            {hiddenCount > 0 && (
              <li className="px-4 py-2 text-xs text-muted-foreground bg-muted/40 inline-flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5" aria-hidden />
                {hiddenCount} hidden test {hiddenCount === 1 ? "case" : "cases"}{" "}
                (grading only)
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── Tiny presentational helpers (kept here so the file stays self-contained) ── */

function SummaryStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "destructive" | "default";
}) {
  const valueClass =
    variant === "success"
      ? "text-success"
      : variant === "destructive"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={`text-sm font-semibold tabular-nums ${valueClass}`}
        aria-label={`${value} ${label.toLowerCase()}`}
      >
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-6 text-center">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-xs">{subtitle}</p>}
    </div>
  );
}

function IoRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success" | "destructive";
}) {
  const valueClass =
    tone === "success"
      ? "bg-success/10 border-success/30 text-foreground"
      : tone === "destructive"
        ? "bg-destructive/10 border-destructive/30 text-destructive"
        : "bg-card border-border text-foreground";
  return (
    <div className="flex gap-2 items-start">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1 w-16">
        {label}
      </span>
      <code
        className={`font-mono text-xs rounded-md border px-2 py-1 whitespace-pre-wrap wrap-break-word min-w-0 flex-1 ${valueClass}`}
      >
        {value || "(empty)"}
      </code>
    </div>
  );
}
