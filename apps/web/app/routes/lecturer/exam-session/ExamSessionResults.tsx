import { useEffect, useRef, useMemo, useState } from "react";
import JSZip from "jszip";
import { useNavigate, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { submissionAPI, resultAPI, examSessionAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  ArrowLeft,
  Search,
  ChevronUp,
  ChevronDown,
  Download,
  CheckSquare,
  Trophy,
  Users,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  X,
  FileCode2,
  FlaskConical,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { buildRow, scoreChipClass } from "./Results/scoring";
import { FileIcon } from "~/components/ui/file-icon";

// Re-exported so other modules (and existing imports) keep working.
export { passedTests, totalTests } from "./Results/scoring";
export type { ResultsRow } from "./Results/scoring";

import { useRegradeProgress } from "./Results/useRegradeProgress";

function ScoreChip({
  passed,
  total,
  status,
}: {
  passed: number;
  total: number;
  status: string;
}) {
  if (total === 0)
    return <span className="text-muted-foreground/50 text-xs">-</span>;

  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap",
        scoreChipClass(passed, total, status),
      )}
    >
      {passed}/{total}
    </span>
  );
}

// ── Score Distribution Histogram (pure CSS) ───────────────────────────────────

function Histogram({ rows }: { rows: ReturnType<typeof buildRow>[] }) {
  const submitted = rows.filter((r) => r.isSubmitted);
  const buckets = [
    { label: "0 – 2", min: 0, max: 2 },
    { label: "2 – 4", min: 2, max: 4 },
    { label: "4 – 6", min: 4, max: 6 },
    { label: "6 – 8", min: 6, max: 8 },
    { label: "8 – 10", min: 8, max: 10 },
  ];

  const counts = buckets.map(
    (b, i) =>
      submitted.filter((r) => {
        const s = r.score10;
        if (i === buckets.length - 1) return s >= b.min && s <= b.max;
        return s >= b.min && s < b.max;
      }).length,
  );
  const maxCount = Math.max(...counts, 1);

  const barColors = [
    "bg-chart-1",
    "bg-chart-2",
    "bg-chart-3",
    "bg-chart-4",
    "bg-chart-5",
  ];

  return (
    <div className="space-y-2">
      {buckets.map((b, i) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-14 shrink-0 text-right">
            {b.label}
          </span>
          <div className="flex-1 bg-muted rounded h-5 relative overflow-hidden">
            <div
              className={cn(
                "h-full rounded transition-all duration-500",
                barColors[i],
              )}
              style={{ width: `${(counts[i] / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-foreground w-6 shrink-0">
            {counts[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Student Detail Modal ───────────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "default" | "info"
> = {
  accepted: "success",
  partial: "warning",
  wrong_answer: "destructive",
  compile_error: "destructive",
  runtime_error: "warning",
  time_limit_exceeded: "warning",
  not_submitted: "default",
  pending: "default",
  running: "info",
};

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? "default";
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant={variant} className="capitalize">
      {label}
    </Badge>
  );
}

function TestcaseRow({ tc, idx }: { tc: any; idx: number }) {
  const [open, setOpen] = useState(false);
  const passed = tc.status === "passed";
  const isError = tc.status === "error";

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        passed
          ? "border-success/30 bg-success/5"
          : isError
            ? "border-warning/30 bg-warning/5"
            : "border-destructive/30 bg-destructive/5",
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-foreground/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white",
              passed ? "bg-success" : isError ? "bg-warning" : "bg-destructive",
            )}
          >
            {passed ? "✓" : isError ? "!" : "✗"}
          </span>
          <span className="text-sm font-medium text-foreground">
            Testcase {idx + 1}
          </span>
          {tc.hasGrader && (
            <Badge
              variant="info"
              className="text-[10px] border-primary/30 bg-primary/10 text-primary"
            >
              Grader
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {tc.executionTime > 0 && (
            <span className="text-xs text-muted-foreground">
              {tc.executionTime}ms
            </span>
          )}
          {open ? (
            <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-inherit px-4 pb-4 pt-3 grid grid-cols-1 gap-3">
          {/* Input */}
          {tc.input !== null && tc.input !== undefined && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Input
              </p>
              <pre className="text-xs bg-foreground text-background rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-40">
                {tc.input || (
                  <span className="italic text-muted-foreground">(empty)</span>
                )}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Expected Output */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Expected Output
                {tc.hasGrader && (
                  <span className="ml-1 normal-case font-normal text-primary">
                    (grader)
                  </span>
                )}
              </p>
              <pre className="text-xs bg-foreground text-success rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-32">
                {(tc.expectedOutput ?? "") || (
                  <span className="italic text-muted-foreground">(empty)</span>
                )}
              </pre>
            </div>

            {/* Actual Output */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Actual Output
              </p>
              <pre
                className={cn(
                  "text-xs rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-32 bg-foreground",
                  passed ? "text-success" : "text-destructive",
                )}
              >
                {tc.actualOutput || (
                  <span className="italic text-muted-foreground">(empty)</span>
                )}
              </pre>
            </div>
          </div>

          {/* Error message */}
          {tc.errorMessage && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-destructive mb-1">
                Error
              </p>
              <pre className="text-xs bg-destructive text-destructive-foreground rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-32">
                {tc.errorMessage}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentDetailModal({
  sessionId,
  studentId,
  studentName,
  onClose,
}: {
  sessionId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [activeTab, setActiveTab] = useState<"code" | "testcases">("code");
  const [activeFile, setActiveFile] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["student-detail", sessionId, studentId],
    queryFn: () => submissionAPI.getStudentDetail(sessionId, studentId),
  });

  const submission = data?.data?.submission;
  const questions = submission?.submissions ?? [];
  const currentQ = questions[activeQuestion];
  const files: { name: string; content: string }[] = currentQ?.files?.length
    ? currentQ.files
    : currentQ?.code
      ? [{ name: currentQ.mainFile || "Main.java", content: currentQ.code }]
      : [];
  const language = submission?.language ?? "java";
  const monacoLang =
    language === "cpp"
      ? "cpp"
      : language === "python"
        ? "python"
        : language === "javascript"
          ? "javascript"
          : "java";

  const handleSelectQuestion = (idx: number) => {
    setActiveQuestion(idx);
    setActiveFile(0);
  };

  const handleDownload = async () => {
    if (!submission) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const allQuestions: any[] = submission.submissions ?? [];

      let hasAnyFile = false;
      for (const q of allQuestions) {
        const qFiles: { name: string; content: string }[] = q.files?.length
          ? q.files
          : q.code
            ? [{ name: q.mainFile || "Main.java", content: q.code }]
            : [];

        for (const f of qFiles) {
          zip.file(`Q${q.questionNumber}/${f.name}`, f.content ?? "");
          hasAnyFile = true;
        }
      }

      if (!hasAnyFile) {
        toast.error("No code files found for this student.");
        return;
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = studentName.replace(/[^a-z0-9]/gi, "_");
      a.download = `submission_${safeName}_code${submission.examCodeNumber ? `_code${submission.examCodeNumber}` : ""}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Download failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay">
      <div
        className="bg-card rounded-xl flex flex-col overflow-hidden border border-border"
        style={{ width: "min(1000px, 96vw)", height: "min(780px, 92vh)" }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {studentName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Exam Code:{" "}
              <span className="font-mono font-semibold text-primary">
                {submission?.examCodeNumber ?? "…"}
              </span>
              {submission?.language && (
                <>
                  {" "}
                  · <span className="capitalize">{submission.language}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {submission && (
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                variant="outline"
                size="sm"
                title="Download all code files as ZIP"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isDownloading ? "Downloading..." : "Download Submission"}
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : !submission ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic">
            No submission found
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar: question list */}
            <div className="w-36 shrink-0 border-r border-border bg-muted overflow-y-auto flex flex-col">
              <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Questions
              </p>
              {questions.map((q: any, i: number) => {
                const passed = (q.testResults || []).filter(
                  (r: any) => r.status === "passed",
                ).length;
                const total = (q.testResults || []).length;
                const pct =
                  total > 0 ? Math.round((passed / total) * 100) : null;
                const isActive = i === activeQuestion;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectQuestion(i)}
                    className={cn(
                      "flex flex-col items-start px-3 py-2.5 text-left cursor-pointer transition-colors border-l-2",
                      isActive
                        ? "border-primary bg-card text-primary"
                        : "border-transparent text-muted-foreground hover:bg-card hover:text-foreground",
                    )}
                  >
                    <span className="text-sm font-semibold">
                      Q{q.questionNumber}
                    </span>
                    {pct !== null ? (
                      <span
                        className={cn(
                          "text-[10px] font-medium mt-0.5",
                          pct === 100
                            ? "text-success"
                            : pct > 0
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {passed}/{total}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 mt-0.5">
                        -
                      </span>
                    )}
                    <StatusBadge status={q.status} />
                  </button>
                );
              })}
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center border-b border-border px-4 gap-1 shrink-0 bg-card">
                <button
                  onClick={() => setActiveTab("code")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 cursor-pointer transition-colors -mb-px",
                    activeTab === "code"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FileCode2 className="w-3.5 h-3.5" /> Code
                </button>
                <button
                  onClick={() => setActiveTab("testcases")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 cursor-pointer transition-colors -mb-px",
                    activeTab === "testcases"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Testcases
                  {currentQ && (
                    <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {(currentQ.testResults || []).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Code Tab */}
              {activeTab === "code" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {files.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic">
                      No code submitted for this question
                    </div>
                  ) : (
                    <>
                      {files.length > 1 && (
                        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted overflow-x-auto shrink-0">
                          {files.map((f, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveFile(i)}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap cursor-pointer transition-colors",
                                i === activeFile
                                  ? "bg-card border border-border text-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-card",
                              )}
                            >
                              <FileIcon name={f.name} className="w-3.5 h-3.5" />
                              {f.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <Editor
                          height="100%"
                          language={monacoLang}
                          value={files[activeFile]?.content ?? ""}
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            renderLineHighlight: "none",
                            contextmenu: false,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Testcases Tab */}
              {activeTab === "testcases" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {!currentQ || currentQ.testResults?.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-10">
                      No testcase results for this question
                    </p>
                  ) : (
                    currentQ.testResults.map((tc: any, i: number) => (
                      <TestcaseRow key={i} tc={tc} idx={i} />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type SortKey = "rank" | "name" | "pct";
type SortDir = "asc" | "desc";

export default function ExamSessionResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showOnlySubmitted, setShowOnlySubmitted] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const [detailModal, setDetailModal] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);

  type RegradeEntry = {
    studentName: string;
    studentEmail: string;
    finalScore: number;
    questionScores: {
      questionNumber: number;
      score: number;
      status: string;
      passedCount: number;
      totalTests: number;
    }[];
    skipped?: boolean;
  };

  const [regradePanel, setRegradePanel] = useState<{
    open: boolean;
    collapsed: boolean;
    graded: number;
    total: number;
    done: boolean;
    error?: string;
    entries: RegradeEntry[];
  } | null>(null);
  const regradeSSERef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (regradeSSERef.current) {
        regradeSSERef.current.close();
        regradeSSERef.current = null;
      }
    };
  }, []);

  const handleRegradeAll = async () => {
    const target = showOnlySubmitted
      ? "submitted exams"
      : "ALL students (including in-progress)";
    if (
      !window.confirm(
        `Re-grade ${target}? This will re-run all student code against the test cases.`,
      )
    )
      return;

    setRegradePanel({
      open: true,
      collapsed: false,
      graded: 0,
      total: 0,
      done: false,
      entries: [],
    });

    if (regradeSSERef.current) {
      regradeSSERef.current.close();
      regradeSSERef.current = null;
    }

    const sseUrl = submissionAPI.regradeProgressUrl(id!);
    const sse = new EventSource(sseUrl, { withCredentials: true });
    regradeSSERef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress") {
          const entry: RegradeEntry = {
            studentName: data.studentName,
            studentEmail: data.studentEmail ?? "",
            finalScore: data.finalScore ?? 0,
            questionScores: data.questionScores ?? [],
            skipped: data.skipped,
          };
          setRegradePanel((prev) =>
            prev
              ? {
                  ...prev,
                  graded: data.graded,
                  total: data.total,
                  entries: [...prev.entries, entry],
                }
              : null,
          );
        } else if (data.type === "done") {
          setRegradePanel((prev) =>
            prev
              ? { ...prev, graded: data.graded, total: data.total, done: true }
              : null,
          );
          sse.close();
          regradeSSERef.current = null;
          queryClient.invalidateQueries({
            queryKey: ["session-submissions", id],
          });
        } else if (data.type === "error") {
          setRegradePanel((prev) =>
            prev ? { ...prev, done: true, error: data.message } : null,
          );
          sse.close();
          regradeSSERef.current = null;
        }
      } catch (_) {}
    };

    sse.onerror = () => {
      /* server closes SSE on done/error - ignore */
    };

    setTimeout(async () => {
      try {
        const resp = await submissionAPI.regradeAll(id!, showOnlySubmitted);
        if (resp.data?.total === 0) {
          setRegradePanel((prev) =>
            prev
              ? {
                  ...prev,
                  done: true,
                  error: "No submitted exams to re-grade.",
                }
              : null,
          );
          sse.close();
          regradeSSERef.current = null;
        } else {
          setRegradePanel((prev) =>
            prev ? { ...prev, total: resp.data.total } : null,
          );
        }
      } catch (err: any) {
        setRegradePanel((prev) =>
          prev
            ? {
                ...prev,
                done: true,
                error: err.response?.data?.error || err.message,
              }
            : null,
        );
        sse.close();
        regradeSSERef.current = null;
      }
    }, 300);
  };

  const { data: sessionData } = useQuery({
    queryKey: ["exam-session", id],
    queryFn: () => examSessionAPI.getById(id!),
    enabled: !!id,
  });

  const { data: subData, isLoading } = useQuery({
    queryKey: ["session-submissions", id],
    queryFn: () => submissionAPI.getAllForSession(id!),
    enabled: !!id,
  });

  const finalizeMutation = useMutation({
    mutationFn: () => resultAPI.finalize(id!),
    onSuccess: () => {
      toast.success("Results finalized successfully");
      queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Finalize failed"),
  });

  const handleExport = async () => {
    try {
      const res = await submissionAPI.exportCSV(id!);
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `results_${session?.sessionName || id}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  const session = sessionData?.data?.session;
  const rawSubmissions: any[] = subData?.data?.submissions || [];

  const handleDownloadAllSubmissions = async () => {
    if (!id || rawSubmissions.length === 0) {
      toast.error("No submissions found for this session.");
      return;
    }

    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      let hasAnyFile = false;

      const safe = (value: string) =>
        String(value || "").replace(/[^a-z0-9._-]/gi, "_");

      for (const sub of rawSubmissions) {
        const studentName = safe(sub?.studentId?.name || "unknown_student");
        const studentEmail = safe(sub?.studentId?.email || "unknown_email");
        const examCode = safe(sub?.examCodeNumber || "NA");
        const studentFolder = `${studentName}_${studentEmail}_code${examCode}`;

        const questions = sub?.submissions || [];
        for (const q of questions) {
          const qFiles: { name: string; content: string }[] = q?.files?.length
            ? q.files
            : q?.code
              ? [{ name: q.mainFile || "Main.java", content: q.code }]
              : [];

          for (const f of qFiles) {
            zip.file(
              `${studentFolder}/Q${q.questionNumber}/${f.name}`,
              f.content ?? "",
            );
            hasAnyFile = true;
          }
        }
      }

      if (!hasAnyFile) {
        toast.error("No code files found to download.");
        return;
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sessionNameSafe = safe(session?.sessionName || id);
      a.download = `all_submissions_${sessionNameSafe}_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Downloaded all student submissions.");
    } catch {
      toast.error("Download all submissions failed.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const maxQuestions = useMemo(() => {
    let max = 0;
    for (const s of rawSubmissions) {
      for (const q of s.submissions || []) {
        if (q.questionNumber > max) max = q.questionNumber;
      }
    }
    return max;
  }, [rawSubmissions]);

  const allRows = useMemo(
    () => rawSubmissions.map((s) => buildRow(s, maxQuestions)),
    [rawSubmissions, maxQuestions],
  );

  const submitted = allRows.filter((r) => r.isSubmitted);
  const avgScore =
    submitted.length > 0
      ? Math.round(
          (submitted.reduce((s, r) => s + r.score10, 0) / submitted.length) *
            10,
        ) / 10
      : 0;
  const highest =
    submitted.length > 0 ? Math.max(...submitted.map((r) => r.score10)) : 0;
  const lowest =
    submitted.length > 0 ? Math.min(...submitted.map((r) => r.score10)) : 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const rows = useMemo(() => {
    let list = showOnlySubmitted
      ? allRows.filter((r) => r.isSubmitted)
      : allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.student?.name?.toLowerCase().includes(q) ||
          r.student?.email?.toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === "rank" || sortKey === "pct") diff = b.pct - a.pct;
      else if (sortKey === "name")
        diff = (a.student?.name || "").localeCompare(b.student?.name || "");
      return sortDir === "asc" ? -diff : diff;
    });
    return list;
  }, [allRows, search, sortKey, sortDir, showOnlySubmitted]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "desc" ? (
        <ChevronDown className="w-3 h-3 inline ml-0.5" />
      ) : (
        <ChevronUp className="w-3 h-3 inline ml-0.5" />
      )
    ) : null;

  const rankMap = useMemo(() => {
    const sorted = [...submitted].sort((a, b) => b.pct - a.pct);
    const map = new Map<string, number>();
    sorted.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [submitted]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/lecturer/exam-sessions/${id}`)}
              className="h-8 rounded-md border border-border bg-muted/70 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </Button>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground leading-tight">
                {session?.sessionName || "Results"}
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {submitted.length} submitted ·{" "}
                {allRows.length - submitted.length} not submitted
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAllSubmissions}
              disabled={isDownloadingAll || rawSubmissions.length === 0}
              className="gap-1.5"
              title="Download all students' code files as ZIP"
            >
              {isDownloadingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isDownloadingAll ? "Downloading..." : "Download All Submissions"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={handleRegradeAll}
              className="gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              Re-grade All
            </Button>
            {session?.status !== "graded" && (
              <Button
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Finalize results? This will assign ranks and lock scores.",
                    )
                  )
                    finalizeMutation.mutate();
                }}
                disabled={finalizeMutation.isPending}
                className="gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                {finalizeMutation.isPending
                  ? "Finalizing…"
                  : "Finalize Results"}
              </Button>
            )}
            {session?.status === "graded" && (
              <Badge variant="success">✓ Finalized</Badge>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Stats + Histogram row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Stats */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Overview</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: <Users className="w-4 h-4 text-primary" />,
                  label: "Submitted",
                  value: `${submitted.length}/${allRows.length}`,
                },
                {
                  icon: <TrendingUp className="w-4 h-4 text-primary" />,
                  label: "Average",
                  value: submitted.length ? `${avgScore.toFixed(1)}/10` : "-",
                },
                {
                  icon: <Trophy className="w-4 h-4 text-warning" />,
                  label: "Highest",
                  value: submitted.length ? `${highest.toFixed(1)}/10` : "-",
                },
                {
                  icon: <AlertTriangle className="w-4 h-4 text-destructive" />,
                  label: "Lowest",
                  value: submitted.length ? `${lowest.toFixed(1)}/10` : "-",
                },
              ].map(({ icon, label, value }) => (
                <div
                  key={label}
                  className="bg-muted rounded-md p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {icon}
                    <span className="text-xs">{label}</span>
                  </div>
                  <span className="text-xl font-bold text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Histogram */}
          <div className="lg:col-span-2 bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Score Distribution
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (thang điểm 10)
              </span>
            </h2>
            {submitted.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                No submitted data yet
              </p>
            ) : (
              <Histogram rows={allRows} />
            )}
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-card rounded-lg border border-border">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search student…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7"
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlySubmitted}
                onChange={(e) => setShowOnlySubmitted(e.target.checked)}
                className="rounded"
              />
              Submitted only
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {rows.length} rows
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12 cursor-pointer whitespace-nowrap"
                    onClick={() => toggleSort("rank")}
                  >
                    # <SortIcon k="rank" />
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    onClick={() => toggleSort("name")}
                  >
                    Student <SortIcon k="name" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Code
                  </th>
                  {Array.from({ length: maxQuestions }, (_, i) => (
                    <th
                      key={i}
                      className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      Q{i + 1}
                    </th>
                  ))}
                  <th
                    className="px-5 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    onClick={() => toggleSort("pct")}
                  >
                    Total <SortIcon k="pct" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Tabs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6 + maxQuestions}
                      className="px-5 py-12 text-center text-sm text-muted-foreground italic"
                    >
                      No results found
                    </td>
                  </tr>
                )}
                {rows.map((row) => {
                  const rank = row.isSubmitted ? rankMap.get(row.id) : null;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/60 transition-colors"
                    >
                      <td className="px-5 py-3 text-center">
                        {rank ? (
                          <span className="text-xs font-bold text-muted-foreground">
                            {rank}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3 max-w-[200px]">
                        <button
                          className="text-left group w-full"
                          onClick={() =>
                            setDetailModal({
                              studentId: row.student?._id,
                              studentName: row.student?.name || "-",
                            })
                          }
                        >
                          <p className="font-medium text-foreground truncate text-sm group-hover:text-primary flex items-center gap-1 transition-colors">
                            {row.student?.name || "-"}
                            <Eye className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {row.student?.email}
                          </p>
                        </button>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-mono text-primary font-semibold">
                          {row.examCode}
                        </span>
                      </td>

                      {row.questions.map((q, qi) => (
                        <td key={qi} className="px-3 py-3 text-center">
                          <ScoreChip
                            passed={q.passed}
                            total={q.total}
                            status={q.status}
                          />
                        </td>
                      ))}

                      <td className="px-5 py-3 text-center">
                        {row.isSubmitted ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-bold text-foreground">
                              {row.score10.toFixed(1)}
                              <span className="text-xs font-normal text-muted-foreground">
                                /10
                              </span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {row.totalPassed}/{row.totalTests} tests
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {row.isSubmitted ? (
                          <Badge variant="success">Submitted</Badge>
                        ) : (
                          <Badge variant="warning">In progress</Badge>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            row.tabSwitches > 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {row.tabSwitches || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Re-grade Background Job Panel (bottom-right, non-blocking) ── */}
      {regradePanel && regradePanel.open && (
        <div
          className="fixed bottom-5 right-5 z-40 bg-card rounded-lg border border-border flex flex-col overflow-hidden"
          style={{ width: "min(360px, calc(100vw - 2rem))" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer select-none hover:bg-muted transition-colors"
            onClick={() =>
              setRegradePanel((prev) =>
                prev ? { ...prev, collapsed: !prev.collapsed } : null,
              )
            }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {regradePanel.done && !regradePanel.error ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : regradePanel.error ? (
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {regradePanel.done && !regradePanel.error
                    ? "Re-grading complete"
                    : regradePanel.error
                      ? "Re-grading failed"
                      : "Re-grading submissions…"}
                </p>
                {regradePanel.total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {regradePanel.graded} / {regradePanel.total} students
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-2 shrink-0">
              <span className="text-muted-foreground text-xs">
                {regradePanel.collapsed ? "▲" : "▼"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRegradePanel(null);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>

          {!regradePanel.collapsed && (
            <>
              {regradePanel.total > 0 && (
                <div className="w-full bg-muted h-0.5">
                  <div
                    className="bg-primary h-0.5 transition-all duration-500"
                    style={{
                      width: `${(regradePanel.graded / regradePanel.total) * 100}%`,
                    }}
                  />
                </div>
              )}

              {regradePanel.error && (
                <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/30">
                  <p className="text-xs text-destructive">
                    {regradePanel.error}
                  </p>
                </div>
              )}

              <div className="overflow-y-auto max-h-64 divide-y divide-border">
                {regradePanel.entries.length === 0 && !regradePanel.done && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">
                      Waiting for results…
                    </p>
                  </div>
                )}
                {[...regradePanel.entries].reverse().map((entry, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate leading-tight">
                          {entry.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.studentEmail}
                        </p>
                      </div>
                      {entry.skipped ? (
                        <span className="text-xs text-muted-foreground shrink-0">
                          -
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-primary shrink-0">
                          {entry.finalScore.toFixed(1)}
                          <span className="text-xs font-normal text-muted-foreground">
                            /10
                          </span>
                        </span>
                      )}
                    </div>
                    {!entry.skipped && entry.questionScores.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entry.questionScores.map((q) => {
                          const variant = STATUS_VARIANT[q.status] ?? "default";
                          const cls = {
                            success:
                              "bg-success/10 text-success border-success/30",
                            warning:
                              "bg-warning/15 text-warning border-warning/30",
                            destructive:
                              "bg-destructive/10 text-destructive border-destructive/30",
                            info: "bg-primary/10 text-primary border-primary/30",
                            default:
                              "bg-muted text-muted-foreground border-border",
                          }[variant];
                          return (
                            <span
                              key={q.questionNumber}
                              className={cn(
                                "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border",
                                cls,
                              )}
                            >
                              Q{q.questionNumber}
                              <span className="font-semibold">
                                {q.score}/10
                              </span>
                              {q.totalTests > 0 && (
                                <span className="opacity-60">
                                  ({q.passedCount}/{q.totalTests})
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Student Detail Modal ── */}
      {detailModal && (
        <StudentDetailModal
          sessionId={id!}
          studentId={detailModal.studentId}
          studentName={detailModal.studentName}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}
