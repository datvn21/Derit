import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  EyeOff,
  Loader2,
  Play,
} from "lucide-react";

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
  isRunning?: boolean;            // full-run (all TCs) — disables every button
  runningTestCaseIdx?: number | null; // E: per-TC run — only that button spins
  questionNumber?: number;
  onRunTestCase?: (testCaseIdx: number) => void;
}

const STATUS_CONFIG = {
  passed: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Passed",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-600",
    label: "Failed",
  },
  error: {
    icon: AlertCircle,
    color: "text-gray-500",
    bg: "bg-gray-50 border-gray-200",
    badge: "bg-gray-100 text-gray-700",
    label: "Error",
  },
  pending: {
    icon: Clock,
    color: "text-gray-400",
    bg: "bg-gray-50 border-gray-200",
    badge: "bg-gray-100 text-gray-500",
    label: "Pending",
  },
};

export default function TestCases({
  testCases,
  isRunning = false,
  runningTestCaseIdx = null,
  questionNumber,
  onRunTestCase,
}: TestCasesProps) {
  const visibleTestCases = testCases.filter((tc) => !tc.isHidden);
  const hiddenCount = testCases.filter((tc) => tc.isHidden).length;
  const passedCount = visibleTestCases.filter(
    (tc) => tc.status === "passed",
  ).length;
  const totalCount = visibleTestCases.length;
  const hasResults = visibleTestCases.some(
    (tc) => tc.status && tc.status !== "pending",
  );

  const questionLabel =
    questionNumber != null ? `Question ${questionNumber}` : null;

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200  overflow-hidden shadow-sm">
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            Test Cases
          </span>
          {questionLabel && (
            <span className="text-sm px-2 py-0.5 rounded bg-blue-100 text-primary font-medium">
              {questionLabel}
            </span>
          )}
        </div>

        {!isRunning && hasResults && totalCount > 0 && (
          <span
            className={`text-xs font-semibold px-2 py-1 rounded tracking-wide`}
          >
            Passed {passedCount}/{totalCount}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        {isRunning ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">
              Running test {questionLabel ? `for ${questionLabel}` : ""}…
            </p>
          </div>
        ) : testCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <AlertCircle className="w-10 h-10" />
            <p className="text-sm">No test case</p>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-2">
            {visibleTestCases.map((tc, index) => {
              const cfg = STATUS_CONFIG[tc.status ?? "pending"];
              const Icon = cfg.icon;
              return (
                <div
                  key={tc.id}
                  className={`rounded-lg border p-3 text-xs ${
                    tc.status && tc.status !== "pending"
                      ? cfg.bg
                      : "bg-white border-gray-200 hover:border-gray-300"
                  } transition-colors`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">
                      {questionLabel
                        ? `${questionLabel} - Test ${index + 1}`
                        : `Test Case ${index + 1}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {tc.status && tc.status !== "pending" && (
                        <span
                          className={`flex items-center gap-1 font-medium ${cfg.badge} px-1.5 py-0.5 rounded-full`}
                        >
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      )}
                      {tc.hasTestFile && onRunTestCase && (
                        (() => {
                          const tcIdx = tc.id - 1;
                          const isThisRunning = runningTestCaseIdx === tcIdx;
                          const disabled = isRunning || isThisRunning;
                          return (
                            <button
                              onClick={() => !disabled && onRunTestCase(tcIdx)}
                              disabled={disabled}
                              title="Chạy test case này"
                              className="flex items-center gap-0.5 px-1.5 py-1.5 rounded bg-primary hover:bg-primary/80 text-white disabled:opacity-50 cursor-pointer"
                            >
                              {isThisRunning ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Play className="w-3 h-3 fill-white" />
                              )}
                            </button>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  {/* I/O rows */}
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5 items-start">
                      <span className="w-16 shrink-0 text-gray-400 pt-0.5">
                        Example:
                      </span>
                      <code className="font-mono bg-white/70 rounded px-1.5 py-0.5 border border-gray-200 text-gray-700 whitespace-pre-wrap break-all min-w-0 flex-1">
                        {tc.input || "(empty)"}
                      </code>
                    </div>
                    <div className="flex gap-1.5 items-start">
                      <span className="w-16 shrink-0 text-gray-400 pt-0.5">
                        Expected:
                      </span>
                      <code className="font-mono bg-white/70 rounded px-1.5 py-0.5 border border-gray-200 text-gray-700 whitespace-pre-wrap break-all min-w-0 flex-1">
                        {tc.expectedOutput || "(empty)"}
                      </code>
                    </div>
                    {(tc.actualOutput !== undefined || tc.errorMessage) && (
                      <div className="flex gap-1.5 items-start">
                        <span className="w-16 shrink-0 text-gray-400 pt-0.5">
                          Output:
                        </span>
                        <code
                          className={`font-mono rounded px-1.5 py-0.5 border whitespace-pre-wrap break-all min-w-0 flex-1 ${
                            tc.status === "passed"
                              ? "bg-gray-50 border-gray-200 text-gray-700"
                              : "bg-red-50 border-red-200 text-red-600"
                          }`}
                        >
                          {tc.status === "passed"
                            ? tc.actualOutput || "(empty)"
                            : tc.status === "error"
                              ? (tc.errorMessage || tc.actualOutput || "(build failed)")
                              : tc.actualOutput || "(wrong)"}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
