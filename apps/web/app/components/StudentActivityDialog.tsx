import { useQuery } from "@tanstack/react-query";
import { submissionAPI } from "~/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  LogIn,
  LogOut,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Terminal,
  Save,
  Monitor,
  ClipboardCopy,
  ClipboardPaste,
  MousePointerClick,
  Maximize,
  Clock,
} from "lucide-react";

interface Props {
  sessionId: string;
  student: {
    _id: string;
    name: string;
    email: string;
    studentId?: string;
    avatar?: string;
  } | null;
  onClose: () => void;
}

interface LogEntry {
  _id: string;
  activityType: string;
  timestamp: string;
  questionNumber?: number | null;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

const EVENT_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bg: string;
    border: string;
    severity: "info" | "warn" | "danger" | "success";
  }
> = {
  exam_join: { icon: LogIn, label: "Joined exam", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", severity: "info" },
  exam_exit: { icon: LogOut, label: "Exited exam", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200", severity: "info" },
  exam_submit: { icon: CheckCircle2, label: "Submitted exam", color: "text-green-600", bg: "bg-green-50", border: "border-green-200", severity: "success" },
  tab_switch: { icon: Eye, label: "Tab switch", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", severity: "danger" },
  fullscreen_exit: { icon: Maximize, label: "Left fullscreen", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", severity: "danger" },
  copy_attempt: { icon: ClipboardCopy, label: "Copy attempt", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", severity: "warn" },
  paste_attempt: { icon: ClipboardPaste, label: "Paste attempt", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", severity: "warn" },
  right_click: { icon: MousePointerClick, "label": "Right-click", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", severity: "warn" },
  code_run_all: { icon: Play, label: "Run all test cases", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", severity: "info" },
  code_run_testcase: { icon: Play, label: "Run test case", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", severity: "info" },
  code_run_console: { icon: Terminal, label: "Console run", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", severity: "info" },
  code_autosave: { icon: Save, label: "Auto-saved", color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-200", severity: "info" },
};

function formatTs(ts: string) {
  return new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDetail(entry: LogEntry): string | null {
  const d = entry.details ?? {};
  switch (entry.activityType) {
    case "tab_switch":
      return `Tab switch count: ${d.tabSwitchCount ?? "?"}`;
    case "exam_join":
      return `Join count: ${d.joinCount ?? "?"}`;
    case "exam_submit":
      return `Score: ${(d.finalScore ?? 0).toFixed(1)}/10 | Questions: ${d.questionCount ?? 0}`;
    case "code_run_testcase":
      return entry.questionNumber != null
        ? `Q${entry.questionNumber} — TC #${d.testCaseIndex ?? "?"}`
        : null;
    case "code_run_all":
      return entry.questionNumber != null ? `Q${entry.questionNumber}` : null;
    case "code_run_console":
      return entry.questionNumber != null ? `Q${entry.questionNumber}` : null;
    default:
      return null;
  }
}

function SeverityStats({ logs }: { logs: LogEntry[] }) {
  const counts = {
    tab_switch: logs.filter((l) => l.activityType === "tab_switch").length,
    fullscreen_exit: logs.filter((l) => l.activityType === "fullscreen_exit").length,
    copy_attempt: logs.filter((l) => l.activityType === "copy_attempt").length,
    paste_attempt: logs.filter((l) => l.activityType === "paste_attempt").length,
    code_run_all: logs.filter((l) => l.activityType === "code_run_all").length,
    code_run_testcase: logs.filter((l) => l.activityType === "code_run_testcase").length,
    code_run_console: logs.filter((l) => l.activityType === "code_run_console").length,
    exam_join: logs.filter((l) => l.activityType === "exam_join").length,
  };

  const suspicious =
    counts.tab_switch +
    counts.fullscreen_exit +
    counts.copy_attempt +
    counts.paste_attempt;

  return (
    <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
      {suspicious > 0 && (
        <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-700 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {suspicious} suspicious event{suspicious > 1 ? "s" : ""} detected
        </div>
      )}
      <StatPill icon={Eye} label="Tab switches" value={counts.tab_switch} color={counts.tab_switch > 0 ? "red" : "gray"} />
      <StatPill icon={ClipboardCopy} label="Copy/Paste" value={counts.copy_attempt + counts.paste_attempt} color={(counts.copy_attempt + counts.paste_attempt) > 0 ? "orange" : "gray"} />
      <StatPill icon={LogIn} label="Joins" value={counts.exam_join} color="blue" />
      <StatPill icon={Play} label="Code runs" value={counts.code_run_all + counts.code_run_testcase + counts.code_run_console} color="blue" />
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  const cls: Record<string, string> = {
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${cls[color] ?? cls.gray}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export default function StudentActivityDialog({ sessionId, student, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-activity", sessionId, student?._id],
    queryFn: () =>
      submissionAPI
        .getStudentActivity(sessionId, student!._id)
        .then((r) => r.data),
    enabled: !!student,
    staleTime: 30_000,
  });

  const logs: LogEntry[] = data?.logs ?? [];
  const submission = data?.submission;

  return (
    <Dialog open={!!student} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {student?.avatar ? (
              <img src={student.avatar} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-sm">
                {student?.name?.charAt(0) ?? "?"}
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-semibold text-gray-900 leading-tight">
                {student?.name}
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                {student?.email}
                {student?.studentId && ` · MSSV ${student.studentId}`}
              </p>
            </div>
          </div>

          {/* Submission summary */}
          {submission && (
            <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${submission.isSubmitted
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
                }`}>
                {submission.isSubmitted ? "Submitted" : "Not submitted"}
              </span>
              <span className="text-gray-500">
                Score: <strong className="text-gray-800">{(submission.finalScore ?? 0).toFixed(1)}/10</strong>
              </span>
              <span className="text-gray-500">
                Code #{submission.examCodeNumber}
              </span>
              {submission.submittedAt && (
                <span className="flex items-center gap-1 text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(submission.submittedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-blue-200 border-t-primary animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">
              No activity recorded for this student.
            </div>
          ) : (
            <>
              <SeverityStats logs={logs} />

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-200" />

                <div className="space-y-2">
                  {logs.map((entry, idx) => {
                    const cfg = EVENT_CONFIG[entry.activityType];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    const detail = formatDetail(entry);
                    return (
                      <div key={entry._id ?? idx} className="flex gap-3 items-start relative">
                        {/* Dot */}
                        <div className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center z-10 ${cfg.bg} ${cfg.border}`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>

                        {/* Content */}
                        <div className={`flex-1 px-3 py-2 rounded-md border text-xs ${cfg.bg} ${cfg.border} min-w-0`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-gray-400 shrink-0 font-mono">{formatTs(entry.timestamp)}</span>
                          </div>
                          {detail && (
                            <p className="text-gray-500 mt-0.5">{detail}</p>
                          )}
                          {entry.ipAddress && (
                            <p className="text-gray-400 mt-0.5 font-mono text-[10px] truncate">
                              IP: {entry.ipAddress}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer note */}

      </DialogContent>
    </Dialog>
  );
}
