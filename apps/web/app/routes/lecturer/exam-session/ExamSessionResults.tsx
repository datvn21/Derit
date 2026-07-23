import { useEffect, useRef, useMemo, useState } from "react";
import JSZip from "jszip";
import { useNavigate, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { submissionAPI, resultAPI, examSessionAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
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
import { toast } from "sonner";
import Editor from "@monaco-editor/react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function passedTests(sub: any) {
  return (sub.testResults || []).filter((r: any) => r.status === "passed").length;
}
function totalTests(sub: any) {
  return (sub.testResults || []).length;
}

/** Compute per-student row data from raw StudentSubmission */
function buildRow(submission: any, maxQuestions: number) {
  const questions: { passed: number; total: number; status: string }[] = Array.from(
    { length: maxQuestions },
    () => ({ passed: 0, total: 0, status: "—" })
  );

  let totalPassed = 0;
  let totalTestCount = 0;

  for (const q of submission.submissions || []) {
    const idx = q.questionNumber - 1;
    if (idx >= 0 && idx < maxQuestions) {
      const p = passedTests(q);
      const t = totalTests(q);
      questions[idx] = { passed: p, total: t, status: q.status };
      totalPassed += p;
      totalTestCount += t;
    }
  }

  return {
    id: submission._id,
    student: submission.studentId,
    examCode: submission.examCodeNumber,
    isSubmitted: submission.isSubmitted,
    tabSwitches: submission.tabSwitchCount || 0,
    joinCount: submission.joinCount || 0,
    questions,
    totalPassed,
    totalTests: totalTestCount,
    pct: totalTestCount > 0 ? Math.round((totalPassed / totalTestCount) * 100) : 0,
    // Score thang 10: dựa trên finalScore từ BE (đã tính theo thang 10)
    score10: submission.finalScore ?? (totalTestCount > 0 ? Math.round((totalPassed / totalTestCount) * 10 * 10) / 10 : 0),
  };
}

// ── Score chip ────────────────────────────────────────────────────────────────

function ScoreChip({ passed, total, status }: { passed: number; total: number; status: string }) {
  if (total === 0) return <span className="text-gray-300 text-xs">—</span>;

  const pct = Math.round((passed / total) * 100);
  let cls = "bg-gray-50 text-gray-500 border-gray-200";
  if (status === "compile_error") cls = "bg-red-50 text-red-600 border-red-200";
  else if (status === "runtime_error" || status === "time_limit_exceeded")
    cls = "bg-orange-50 text-orange-600 border-orange-200";
  else if (status === "partial") cls = "bg-amber-50 text-amber-700 border-amber-200";
  else if (pct >= 80) cls = "bg-green-50 text-green-700 border-green-200";
  else if (pct >= 40) cls = "bg-amber-50 text-amber-700 border-amber-200";
  else cls = "bg-red-50 text-red-600 border-red-200";

  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}
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

  const counts = buckets.map((b, i) =>
    submitted.filter((r) => {
      const s = r.score10;
      // bucket cuối cùng (8–10) lấy luôn điểm 10
      if (i === buckets.length - 1) return s >= b.min && s <= b.max;
      return s >= b.min && s < b.max;
    }).length
  );
  const maxCount = Math.max(...counts, 1);

  const barColors = [
    "bg-red-400",
    "bg-orange-400",
    "bg-amber-400",
    "bg-blue-400",
    "bg-green-500",
  ];

  return (
    <div className="space-y-2">
      {buckets.map((b, i) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-14 shrink-0 text-right">{b.label}</span>
          <div className="flex-1 bg-gray-100 rounded h-5 relative overflow-hidden">
            <div
              className={`h-full rounded transition-all duration-500 ${barColors[i]}`}
              style={{ width: `${(counts[i] / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-6 shrink-0">
            {counts[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Student Detail Modal ───────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  accepted: "bg-green-50 text-green-700 border-green-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  wrong_answer: "bg-red-50 text-red-600 border-red-200",
  compile_error: "bg-red-50 text-red-600 border-red-200",
  runtime_error: "bg-orange-50 text-orange-600 border-orange-200",
  time_limit_exceeded: "bg-orange-50 text-orange-600 border-orange-200",
  not_submitted: "bg-gray-50 text-gray-500 border-gray-200",
  pending: "bg-gray-50 text-gray-400 border-gray-200",
  running: "bg-blue-50 text-blue-600 border-blue-200",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? "bg-gray-50 text-gray-500 border-gray-200";
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function TestcaseRow({ tc, idx }: { tc: any; idx: number }) {
  const [open, setOpen] = useState(false);
  const passed = tc.status === "passed";
  const isError = tc.status === "error";

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${passed ? "border-green-200 bg-green-50/30" :
      isError ? "border-orange-200 bg-orange-50/20" :
        "border-red-200 bg-red-50/20"
      }`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${passed ? "bg-green-500 text-white" :
            isError ? "bg-orange-400 text-white" :
              "bg-red-400 text-white"
            }`}>
            {passed ? "✓" : isError ? "!" : "✗"}
          </span>
          <span className="text-sm font-medium text-gray-700">Testcase {idx + 1}</span>
          {tc.hasGrader && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 border border-purple-200 font-medium">
              Grader
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {tc.executionTime > 0 && (
            <span className="text-xs text-gray-400">{tc.executionTime}ms</span>
          )}
          {open ? <ChevronDownIcon className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-inherit px-4 pb-4 pt-3 grid grid-cols-1 gap-3">
          {/* Input */}
          {tc.input !== null && tc.input !== undefined && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Input</p>
              <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-40">
                {tc.input || <span className="italic text-gray-500">(empty)</span>}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Expected Output — always visible */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Expected Output
                {tc.hasGrader && (
                  <span className="ml-1 normal-case font-normal text-purple-400">(grader)</span>
                )}
              </p>
              <pre className="text-xs bg-gray-900 text-emerald-300 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-32">
                {(tc.expectedOutput ?? "") || <span className="italic text-gray-500">(empty)</span>}
              </pre>
            </div>

            {/* Actual Output — always visible */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Actual Output
              </p>
              <pre className={`text-xs rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-32 ${passed ? "bg-gray-900 text-emerald-300" : "bg-gray-900 text-red-300"
                }`}>
                {tc.actualOutput || <span className="italic text-gray-500">(empty)</span>}
              </pre>
            </div>
          </div>

          {/* Error message */}
          {tc.errorMessage && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-1">Error</p>
              <pre className="text-xs bg-red-950 text-red-300 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-32">
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
  const monacoLang = language === "cpp" ? "cpp" : language === "python" ? "python" : language === "javascript" ? "javascript" : "java";

  // Reset file tab when question changes
  const handleSelectQuestion = (idx: number) => {
    setActiveQuestion(idx);
    setActiveFile(0);
  };

  // Download all submitted files as a ZIP
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(1000px, 96vw)", height: "min(780px, 92vh)" }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{studentName}</h2>
            <p className="text-xs text-gray-400">
              Exam Code: <span className="font-mono font-semibold text-primary">{submission?.examCodeNumber ?? "…"}</span>
              {submission?.language && (
                <> · <span className="capitalize">{submission.language}</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {submission && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                title="Download all code files as ZIP"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-primary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                {isDownloading ? "Đang tải…" : "Tải bài"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : !submission ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400 italic">
            No submission found
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar: question list */}
            <div className="w-36 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto flex flex-col">
              <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Questions</p>
              {questions.map((q: any, i: number) => {
                const passed = (q.testResults || []).filter((r: any) => r.status === "passed").length;
                const total = (q.testResults || []).length;
                const pct = total > 0 ? Math.round((passed / total) * 100) : null;
                const isActive = i === activeQuestion;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectQuestion(i)}
                    className={`flex flex-col items-start px-3 py-2.5 text-left transition-colors border-l-2 ${isActive
                      ? "border-primary bg-white text-primary"
                      : "border-transparent text-gray-600 hover:bg-white hover:text-gray-900"
                      }`}
                  >
                    <span className="text-sm font-semibold">Q{q.questionNumber}</span>
                    {pct !== null ? (
                      <span className={`text-[10px] font-medium mt-0.5 ${pct === 100 ? "text-green-600" : pct > 0 ? "text-amber-600" : "text-red-500"
                        }`}>
                        {passed}/{total}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300 mt-0.5">—</span>
                    )}
                    <StatusBadge status={q.status} />
                  </button>
                );
              })}
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center border-b border-gray-200 px-4 gap-1 shrink-0 bg-white">
                <button
                  onClick={() => setActiveTab("code")}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === "code"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" /> Code
                </button>
                <button
                  onClick={() => setActiveTab("testcases")}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === "testcases"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Testcases
                  {currentQ && (
                    <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {(currentQ.testResults || []).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Code Tab */}
              {activeTab === "code" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {files.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-gray-400 italic">
                      No code submitted for this question
                    </div>
                  ) : (
                    <>
                      {/* File tabs */}
                      {files.length > 1 && (
                        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50 overflow-x-auto shrink-0">
                          {files.map((f, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveFile(i)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors ${i === activeFile
                                ? "bg-white border border-gray-200 text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-800 hover:bg-white"
                                }`}
                            >
                              <FileCode2 className="w-3 h-3" />
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
                    <p className="text-sm text-gray-400 italic text-center py-10">
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

  // ── Detail modal state ────────────────────────────────────────────────────
  const [detailModal, setDetailModal] = useState<{ studentId: string; studentName: string } | null>(null);

  // ── Regrade state ─────────────────────────────────────────────────────────
  type RegradeEntry = {
    studentName: string;
    studentEmail: string;
    finalScore: number;
    questionScores: { questionNumber: number; score: number; status: string; passedCount: number; totalTests: number }[];
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

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (regradeSSERef.current) {
        regradeSSERef.current.close();
        regradeSSERef.current = null;
      }
    };
  }, []);

  // Re-grade all handler
  const handleRegradeAll = async () => {
    const target = showOnlySubmitted ? "submitted exams" : "ALL students (including in-progress)";
    if (!window.confirm(`Re-grade ${target}? This will re-run all student code against the test cases.`)) return;

    setRegradePanel({ open: true, collapsed: false, graded: 0, total: 0, done: false, entries: [] });

    if (regradeSSERef.current) {
      regradeSSERef.current.close();
      regradeSSERef.current = null;
    }

    // Open SSE stream FIRST
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
          setRegradePanel(prev => prev ? {
            ...prev,
            graded: data.graded,
            total: data.total,
            entries: [...prev.entries, entry],
          } : null);
        } else if (data.type === "done") {
          setRegradePanel(prev => prev ? { ...prev, graded: data.graded, total: data.total, done: true } : null);
          sse.close();
          regradeSSERef.current = null;
          queryClient.invalidateQueries({ queryKey: ["session-submissions", id] });
        } else if (data.type === "error") {
          setRegradePanel(prev => prev ? { ...prev, done: true, error: data.message } : null);
          sse.close();
          regradeSSERef.current = null;
        }
      } catch (_) { }
    };

    sse.onerror = () => { /* server closes SSE on done/error — ignore */ };

    // 300ms buffer so SSE is registered before backend starts emitting
    setTimeout(async () => {
      try {
        const resp = await submissionAPI.regradeAll(id!, showOnlySubmitted);
        if (resp.data?.total === 0) {
          setRegradePanel(prev => prev ? { ...prev, done: true, error: "No submitted exams to re-grade." } : null);
          sse.close();
          regradeSSERef.current = null;
        } else {
          setRegradePanel(prev => prev ? { ...prev, total: resp.data.total } : null);
        }
      } catch (err: any) {
        setRegradePanel(prev => prev ? { ...prev, done: true, error: err.response?.data?.error || err.message } : null);
        sse.close();
        regradeSSERef.current = null;
      }
    }, 300);
  };

  // Fetch session info
  const { data: sessionData } = useQuery({
    queryKey: ["exam-session", id],
    queryFn: () => examSessionAPI.getById(id!),
    enabled: !!id,
  });

  // Fetch all submissions
  const { data: subData, isLoading } = useQuery({
    queryKey: ["session-submissions", id],
    queryFn: () => submissionAPI.getAllForSession(id!),
    enabled: !!id,
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: () => resultAPI.finalize(id!),
    onSuccess: () => {
      toast.success("Results finalized successfully");
      queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Finalize failed"),
  });

  // Export CSV — reads from StudentSubmission, works without finalize
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

  // Determine max questions across all submissions
  const maxQuestions = useMemo(() => {
    let max = 0;
    for (const s of rawSubmissions) {
      for (const q of s.submissions || []) {
        if (q.questionNumber > max) max = q.questionNumber;
      }
    }
    return max;
  }, [rawSubmissions]);

  // Build rows
  const allRows = useMemo(
    () => rawSubmissions.map((s) => buildRow(s, maxQuestions)),
    [rawSubmissions, maxQuestions]
  );

  // Stats
  const submitted = allRows.filter((r) => r.isSubmitted);
  const avgScore =
    submitted.length > 0
      ? Math.round((submitted.reduce((s, r) => s + r.score10, 0) / submitted.length) * 10) / 10
      : 0;
  const highest = submitted.length > 0 ? Math.max(...submitted.map((r) => r.score10)) : 0;
  const lowest = submitted.length > 0 ? Math.min(...submitted.map((r) => r.score10)) : 0;

  // Sort + filter
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const rows = useMemo(() => {
    let list = showOnlySubmitted ? allRows.filter((r) => r.isSubmitted) : allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.student?.name?.toLowerCase().includes(q) ||
          r.student?.email?.toLowerCase().includes(q)
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

  // Rank among submitted rows sorted by pct desc
  const rankMap = useMemo(() => {
    const sorted = [...submitted].sort((a, b) => b.pct - a.pct);
    const map = new Map<string, number>();
    sorted.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [submitted]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/lecturer/exam-sessions/${id}`)}
              className="text-gray-500 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {session?.sessionName || "Results"}
              </h1>
              <p className="text-xs text-gray-500">
                {submitted.length} submitted · {allRows.length - submitted.length} not submitted
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="cursor-pointer gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            {/* Re-grade All button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegradeAll}
              className="cursor-pointer gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50"
            >
              <RefreshCw className="w-4 h-4" />
              Re-grade All
            </Button>
            {session?.status !== "graded" && (
              <Button
                size="sm"
                onClick={() => {
                  if (window.confirm("Finalize results? This will assign ranks and lock scores."))
                    finalizeMutation.mutate();
                }}
                disabled={finalizeMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white cursor-pointer gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                {finalizeMutation.isPending ? "Finalizing…" : "Finalize Results"}
              </Button>
            )}
            {session?.status === "graded" && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                ✓ Finalized
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Stats + Histogram row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Overview</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Users className="w-4 h-4 text-primary" />, label: "Submitted", value: `${submitted.length}/${allRows.length}` },
                { icon: <TrendingUp className="w-4 h-4 text-blue-500" />, label: "Average", value: submitted.length ? `${avgScore.toFixed(1)}/10` : "—" },
                { icon: <Trophy className="w-4 h-4 text-amber-500" />, label: "Highest", value: submitted.length ? `${highest.toFixed(1)}/10` : "—" },
                { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: "Lowest", value: submitted.length ? `${lowest.toFixed(1)}/10` : "—" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-gray-50 rounded-md p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    {icon}
                    <span className="text-xs">{label}</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Histogram */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Score Distribution
              <span className="text-xs font-normal text-gray-400 ml-2">
                (thang điểm 10)
              </span>
            </h2>
            {submitted.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-6">No submitted data yet</p>
            ) : (
              <Histogram rows={allRows} />
            )}
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Table toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search student…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlySubmitted}
                onChange={(e) => setShowOnlySubmitted(e.target.checked)}
                className="rounded"
              />
              Submitted only
            </label>
            <span className="ml-auto text-xs text-gray-400">{rows.length} rows</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12 cursor-pointer whitespace-nowrap"
                    onClick={() => toggleSort("rank")}
                  >
                    # <SortIcon k="rank" />
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    onClick={() => toggleSort("name")}
                  >
                    Student <SortIcon k="name" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Code
                  </th>
                  {Array.from({ length: maxQuestions }, (_, i) => (
                    <th
                      key={i}
                      className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      Q{i + 1}
                    </th>
                  ))}
                  <th
                    className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    onClick={() => toggleSort("pct")}
                  >
                    Total <SortIcon k="pct" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Tabs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6 + maxQuestions}
                      className="px-5 py-12 text-center text-sm text-gray-400 italic"
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
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-5 py-3 text-center">
                        {rank ? (
                          <span
                            className={`text-xs font-bold text-gray-400`}
                          >
                            {rank}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Student */}
                      <td className="px-5 py-3 max-w-[200px]">
                        <button
                          className="text-left group w-full"
                          onClick={() => setDetailModal({ studentId: row.student?._id, studentName: row.student?.name || "—" })}
                        >
                          <p className="font-medium text-gray-900 truncate text-sm group-hover:text-primary flex items-center gap-1 transition-colors">
                            {row.student?.name || "—"}
                            <Eye className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {row.student?.email}
                          </p>
                        </button>
                      </td>

                      {/* Exam code */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-mono text-primary font-semibold">
                          {row.examCode}
                        </span>
                      </td>

                      {/* Per-question scores */}
                      {row.questions.map((q, qi) => (
                        <td key={qi} className="px-3 py-3 text-center">
                          <ScoreChip
                            passed={q.passed}
                            total={q.total}
                            status={q.status}
                          />
                        </td>
                      ))}

                      {/* Total */}
                      <td className="px-5 py-3 text-center">
                        {row.isSubmitted ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-bold text-gray-900">
                              {row.score10.toFixed(1)}<span className="text-xs font-normal text-gray-400">/10</span>
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {row.totalPassed}/{row.totalTests} tests
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 text-center">
                        {row.isSubmitted ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            Submitted
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            In progress
                          </span>
                        )}
                      </td>

                      {/* Tab switches */}
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-xs font-medium ${row.tabSwitches > 0 ? "text-red-500" : "text-gray-400"
                            }`}
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
        <div className="fixed bottom-5 right-5 z-40 bg-white rounded-lg border border-gray-200 shadow-lg flex flex-col overflow-hidden" style={{ width: "min(360px, calc(100vw - 2rem))" }}>
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-50 transition-colors"
            onClick={() => setRegradePanel(prev => prev ? { ...prev, collapsed: !prev.collapsed } : null)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {regradePanel.done && !regradePanel.error ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : regradePanel.error ? (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {regradePanel.done && !regradePanel.error
                    ? "Re-grading complete"
                    : regradePanel.error
                      ? "Re-grading failed"
                      : "Re-grading submissions…"}
                </p>
                {regradePanel.total > 0 && (
                  <p className="text-xs text-gray-500">
                    {regradePanel.graded} / {regradePanel.total} students
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-2 shrink-0">
              <span className="text-gray-400 text-xs">{regradePanel.collapsed ? "▲" : "▼"}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setRegradePanel(null); }}
                className="text-gray-400 hover:text-gray-700 transition-colors text-base leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>

          {!regradePanel.collapsed && (
            <>
              {/* Slim progress bar */}
              {regradePanel.total > 0 && (
                <div className="w-full bg-gray-100 h-0.5">
                  <div
                    className="bg-primary h-0.5 transition-all duration-500"
                    style={{ width: `${(regradePanel.graded / regradePanel.total) * 100}%` }}
                  />
                </div>
              )}

              {/* Error */}
              {regradePanel.error && (
                <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                  <p className="text-xs text-red-600">{regradePanel.error}</p>
                </div>
              )}

              {/* Student list */}
              <div className="overflow-y-auto max-h-64 divide-y divide-gray-100">
                {regradePanel.entries.length === 0 && !regradePanel.done && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <p className="text-xs text-gray-400">Waiting for results…</p>
                  </div>
                )}
                {[...regradePanel.entries].reverse().map((entry, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">{entry.studentName}</p>
                        <p className="text-xs text-gray-400 truncate">{entry.studentEmail}</p>
                      </div>
                      {entry.skipped ? (
                        <span className="text-xs text-gray-400 shrink-0">—</span>
                      ) : (
                        <span className="text-sm font-semibold text-primary shrink-0">
                          {entry.finalScore.toFixed(1)}<span className="text-xs font-normal text-gray-400">/10</span>
                        </span>
                      )}
                    </div>
                    {/* Per-question chips */}
                    {!entry.skipped && entry.questionScores.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entry.questionScores.map((q) => (
                          <span
                            key={q.questionNumber}
                            className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${q.status === "accepted"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : q.status === "compile_error"
                                ? "bg-red-50 text-red-600 border-red-200"
                                : q.status === "runtime_error" || q.status === "time_limit_exceeded"
                                  ? "bg-orange-50 text-orange-600 border-orange-200"
                                  : q.status === "partial"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                          >
                            Q{q.questionNumber}
                            <span className="font-semibold">{q.score}/10</span>
                            {q.totalTests > 0 && (
                              <span className="opacity-60">({q.passedCount}/{q.totalTests})</span>
                            )}
                          </span>
                        ))}
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
