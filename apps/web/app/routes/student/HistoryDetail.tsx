/**
 * Student History detail - per-session breakdown for one exam.
 *
 * Data sources:
 *   - `resultAPI.getMyResult(sessionId)` → score breakdown by question
 *   - `submissionAPI.getByExam(sessionId)` → code + per-question test results
 *
 * Layout:
 *   1. Header  : exam + session + score badge + status
 *   2. Summary : tiles (total score, percentage, time, attempts)
 *   3. Per-question cards : title, score, attempts, status, code (read-only)
 *   4. Footer  : proctoring flags + back-to-history link
 */
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  Trophy,
  Hash,
  AlertTriangle,
  Code2,
  CheckCircle2,
  XCircle,
  Loader2,
  Gauge,
  History,
} from "lucide-react";
import { resultAPI, submissionAPI } from "~/lib/api";
import { useRequireRole } from "~/hooks/useAuth";
import { PageLoading } from "~/components/ui/page-loading";
import { Badge } from "~/components/ui/badge";
import { FileIcon } from "~/components/ui/file-icon";
import type {
  ExamResult,
  QuestionScore,
  StudentSubmission,
  QuestionSubmission,
} from "~/types/api";

function percentageVariant(
  pct: number,
): "success" | "warning" | "destructive" | "default" {
  if (pct >= 80) return "success";
  if (pct >= 50) return "warning";
  if (pct > 0) return "destructive";
  return "default";
}

function statusVariant(
  status: QuestionSubmission["status"],
): "success" | "destructive" | "warning" | "default" | "info" {
  switch (status) {
    case "accepted":
      return "success";
    case "wrong_answer":
    case "compile_error":
    case "runtime_error":
    case "time_limit_exceeded":
      return "destructive";
    case "partial":
      return "warning";
    case "running":
      return "info";
    default:
      return "default";
  }
}

function statusLabel(status: QuestionSubmission["status"]): string {
  return status.replace(/_/g, " ");
}

function formatDuration(minutes: number): string {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

export default function HistoryDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const user = useRequireRole("student");

  const resultQuery = useQuery({
    queryKey: ["student-result", sessionId],
    queryFn: () =>
      resultAPI
        .getMyResult(sessionId!)
        .then((r) => r.data.result as ExamResult),
    enabled: !!user && !!sessionId,
    retry: false,
  });

  const submissionQuery = useQuery({
    queryKey: ["student-submission", sessionId],
    queryFn: () =>
      submissionAPI
        .getByExam(sessionId!)
        .then((r) => r.data.submission as StudentSubmission | null),
    enabled: !!user && !!sessionId,
  });

  if (!user) {
    return <PageLoading label="Loading result…" />;
  }

  if (resultQuery.isLoading) {
    return <PageLoading label="Loading result…" />;
  }

  if (resultQuery.isError || !resultQuery.data) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
        <Link
          to="/student/history"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-[color] duration-(--motion-fast) ease-(--motion-ease)"
        >
          <ArrowLeft className="w-4 h-4" /> Back to history
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <XCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-base font-medium text-foreground">
            Result not available
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            We couldn't find a result for this exam. You may not have submitted
            it.
          </p>
        </div>
      </div>
    );
  }

  const result = resultQuery.data;
  const submission = submissionQuery.data;
  const session = result.examSessionId;
  const examName = session?.examTemplateId?.examName ?? "Unknown exam";
  const sessionName = session?.sessionName ?? "Untitled session";
  const percentage = result.percentage ?? 0;

  // Build a map from questionId → submission for that question
  const submissionByNumber = new Map<number, QuestionSubmission>();
  if (submission?.submissions) {
    for (const qs of submission.submissions) {
      submissionByNumber.set(qs.questionNumber, qs);
    }
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto w-full">
      {/* Back link */}
      <Link
        to="/student/history"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-[color] duration-(--motion-fast) ease-(--motion-ease) w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to history
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {examName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Session: {sessionName}
            </p>
          </div>
          <Badge
            variant={percentageVariant(percentage)}
            className="text-base px-3 py-1"
          >
            {result.totalScore.toFixed(1)} / {result.maxPossibleScore}
            <span className="opacity-70 ml-1">({percentage.toFixed(1)}%)</span>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="info">
            <Hash className="w-3 h-3" /> Code #
            {submission?.examCodeNumber ?? "-"}
          </Badge>
          {result.isFinalized && (
            <Badge variant="info">
              <Trophy className="w-3 h-3" /> Finalized
            </Badge>
          )}
          {result.rank != null && <Badge>Rank #{result.rank}</Badge>}
          {(result.tabSwitchCount ?? 0) > 0 && (
            <Badge variant="warning">
              <AlertTriangle className="w-3 h-3" />
              {result.tabSwitchCount} tab switch
              {result.tabSwitchCount > 1 ? "es" : ""}
            </Badge>
          )}
          {(result.suspiciousActivities?.length ?? 0) > 0 && (
            <Badge variant="destructive">
              <AlertTriangle className="w-3 h-3" /> Flagged
            </Badge>
          )}
        </div>
      </header>

      {/* Summary tiles */}
      <section
        aria-label="Result summary"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <SummaryTile
          icon={Trophy}
          label="Final score"
          value={`${result.totalScore.toFixed(1)}`}
          sub={`of ${result.maxPossibleScore}`}
        />
        <SummaryTile
          icon={Gauge}
          label="Percentage"
          value={`${percentage.toFixed(1)}%`}
        />
        <SummaryTile
          icon={Clock}
          label="Time spent"
          value={formatDuration(result.totalTimeSpent)}
        />
        <SummaryTile
          icon={Hash}
          label="Submitted"
          value={formatDate(result.lastSubmittedAt)}
          small
        />
      </section>

      {/* Per-question breakdown */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Question breakdown
        </h2>

        {result.questionScores.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No question-level data recorded for this exam.
          </div>
        ) : (
          <div className="space-y-3">
            {result.questionScores.map((qs, idx) => {
              const qKey =
                typeof qs.questionId === "object" && qs.questionId !== null
                  ? qs.questionId._id
                  : qs.questionId?.toString();
              return (
                <QuestionCard
                  key={qKey ?? `q-${idx}`}
                  index={idx + 1}
                  qs={qs}
                  submission={submissionByNumber.get(idx + 1) ?? null}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Metadata footer */}
      <footer className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="uppercase tracking-wider font-medium mb-1">Started</p>
            <p className="text-foreground">{formatDate(result.startedAt)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider font-medium mb-1">
              Last submission
            </p>
            <p className="text-foreground">
              {formatDate(result.lastSubmittedAt)}
            </p>
          </div>
          {result.suspiciousActivities?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="uppercase tracking-wider font-medium mb-1 text-destructive">
                Proctoring flags
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.suspiciousActivities.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Local presentation components                     */
/* -------------------------------------------------------------------------- */

function SummaryTile({
  icon: Icon,
  label,
  value,
  sub,
  small,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-muted">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className={
          small
            ? "text-sm font-medium text-foreground"
            : "text-2xl font-bold text-foreground tracking-tight"
        }
      >
        {value}
        {sub && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </p>
    </div>
  );
}

function QuestionCard({
  index,
  qs,
  submission,
}: {
  index: number;
  qs: QuestionScore & {
    questionId?: { _id: string; title?: string } | string;
  };
  submission: QuestionSubmission | null;
}) {
  // Resolve question title - backend populates questionId with title.
  const title =
    typeof qs.questionId === "object" && qs.questionId !== null
      ? qs.questionId.title
      : undefined;

  const scorePct = qs.bestScore ?? 0;
  const attempts = qs.totalAttempts ?? 0;
  const subStatus = submission?.status;

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center text-sm font-semibold shrink-0">
            {index}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {title ?? `Question ${index}`}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {attempts === 0
                ? "Not attempted"
                : `${attempts} submission${attempts > 1 ? "s" : ""}`}
              {subStatus && (
                <>
                  {" · "}
                  <span>{statusLabel(subStatus)}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={percentageVariant(scorePct)}>
            {scorePct.toFixed(0)}%
          </Badge>
        </div>
      </header>

      {/* Per-question test results summary (from submission) */}
      {submission && (submission.testResults?.length ?? 0) > 0 && (
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Test cases
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(submission.testResults ?? []).map((tr, i) => (
              <Badge
                key={i}
                variant={
                  tr.status === "passed"
                    ? "success"
                    : tr.status === "pending"
                      ? "default"
                      : "destructive"
                }
                className="font-mono"
              >
                #{i + 1}{" "}
                {tr.status === "passed" ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : tr.status === "pending" ? (
                  <Loader2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {tr.executionTime > 0 && (
                  <span className="opacity-70 ml-1">{tr.executionTime}ms</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Read-only code block */}
      {submission &&
        (submission.code ||
          (submission.files && submission.files.length > 0)) && (
          <details className="group">
            <summary className="flex items-center gap-2 px-5 py-3 cursor-pointer list-none select-none hover:bg-muted/50 transition-[background-color] duration-(--motion-fast) ease-(--motion-ease)">
              <Code2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                View submitted code
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {submission.language}
              </span>
            </summary>
            <div className="border-t border-border bg-muted">
              {submission.code && (
                <pre className="px-5 py-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
                  {submission.code}
                </pre>
              )}
              {submission.files?.map((f, i) => (
                <div key={i} className="border-t border-border">
                  <div className="px-5 py-1.5 text-xs font-medium text-muted-foreground bg-background flex items-center gap-2">
                    <FileIcon name={f.name} className="w-3.5 h-3.5" />
                    <span>{f.name}</span>
                  </div>
                  <pre className="px-5 py-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
                    {f.content}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        )}
    </article>
  );
}
