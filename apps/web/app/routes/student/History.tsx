/**
 * Student History — list of past exam sessions with the student's score.
 *
 * Data source: `GET /api/results/history` (already wired to `resultAPI.getHistory`).
 * Each row links to the per-session detail endpoint for a full breakdown.
 */
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { History, ChevronRight, Trophy, Clock, AlertTriangle } from "lucide-react";
import { resultAPI } from "~/lib/api";
import { useRequireRole } from "~/hooks/useAuth";
import { PageLoading } from "~/components/ui/page-loading";
import { Badge } from "~/components/ui/badge";
import AuthenticatedShell, { type NavItem } from "~/components/AuthenticatedShell";
import { Gauge } from "lucide-react";
import type { ExamResult } from "~/types/api";

const studentNavigation: NavItem[] = [
  { name: "Dashboard", href: "/student", icon: Gauge, exact: true },
  { name: "History", href: "/student/history", icon: History },
];

function scoreVariant(
  percentage: number,
): "success" | "warning" | "destructive" | "default" {
  if (percentage >= 80) return "success";
  if (percentage >= 50) return "warning";
  if (percentage > 0) return "destructive";
  return "default";
}

function formatDuration(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function StudentHistory() {
  const user = useRequireRole("student");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["student-history"],
    queryFn: () => resultAPI.getHistory().then((r) => r.data),
    enabled: !!user,
  });

  if (!user) {
    return <PageLoading label="Loading history…" />;
  }

  const results: ExamResult[] = data?.results ?? [];

  // Aggregate stats for the page header
  const total = results.length;
  const avgPercentage =
    total > 0
      ? results.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / total
      : 0;
  const bestResult = results.reduce<ExamResult | null>(
    (best, r) => (best && best.totalScore >= r.totalScore ? best : r),
    null,
  );

  return (
    <AuthenticatedShell navigation={studentNavigation} roleLabel="Student">
      <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto w-full">
        {/* Page heading */}
        <header>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            My History
          </h1>
          <p className="text-sm text-muted-foreground">
            Past exams and your scores. Click a row to see the full breakdown.
          </p>
        </header>

        {/* Summary cards */}
        {total > 0 && (
          <section
            aria-label="History summary"
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <SummaryTile
              icon={History}
              label="Exams taken"
              value={String(total)}
            />
            <SummaryTile
              icon={Trophy}
              label="Average score"
              value={`${avgPercentage.toFixed(1)}%`}
            />
            <SummaryTile
              icon={Clock}
              label="Best score"
              value={
                bestResult
                  ? `${bestResult.totalScore.toFixed(1)} / ${bestResult.maxPossibleScore}`
                  : "—"
              }
            />
          </section>
        )}

        {/* Results table */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              Results
            </h2>
            {isFetching && (
              <span className="text-xs text-muted-foreground">Refreshing…</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : total === 0 ? (
            <div className="text-center py-16">
              <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-base font-medium text-muted-foreground">
                No exam history yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Submit your first exam to see it appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.map((r) => {
                const sessionName =
                  r.examSessionId?.sessionName ?? "Untitled session";
                const examName =
                  r.examSessionId?.examTemplateId?.examName ?? "Unknown exam";
                const submittedAt = r.lastSubmittedAt
                  ? new Date(r.lastSubmittedAt)
                  : null;
                const suspicious =
                  (r.tabSwitchCount ?? 0) > 0 ||
                  (r.suspiciousActivities?.length ?? 0) > 0;

                return (
                  <Link
                    key={r._id}
                    to={`/student/history/${r.examSessionId?._id ?? r._id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-[background-color] duration-(--motion-fast) ease-(--motion-ease) hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50"
                  >
                    {/* Date column */}
                    <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-muted text-foreground shrink-0">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {submittedAt
                          ? submittedAt.toLocaleString("en-US", {
                              month: "short",
                            })
                          : "—"}
                      </span>
                      <span className="text-xl font-bold leading-none">
                        {submittedAt ? submittedAt.getDate() : "?"}
                      </span>
                    </div>

                    {/* Exam info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">
                          {examName}
                        </h3>
                        <Badge variant={scoreVariant(r.percentage)}>
                          {r.totalScore.toFixed(1)} / {r.maxPossibleScore}
                        </Badge>
                        {r.isFinalized && (
                          <Badge variant="info">
                            <Trophy className="w-3 h-3" /> Final
                          </Badge>
                        )}
                        {suspicious && (
                          <Badge variant="destructive">
                            <AlertTriangle className="w-3 h-3" /> Flagged
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>Session: {sessionName}</span>
                        <span>Time: {formatDuration(r.totalTimeSpent)}</span>
                        {r.rank != null && <span>Rank: #{r.rank}</span>}
                        {submittedAt && (
                          <span>
                            Submitted {submittedAt.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AuthenticatedShell>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
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
      <p className="text-2xl font-bold text-foreground tracking-tight">
        {value}
      </p>
    </div>
  );
}
