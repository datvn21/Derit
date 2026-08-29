import { useQuery } from "@tanstack/react-query";
import { submissionAPI } from "~/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge, type BadgeProps } from "~/components/ui/badge";
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

interface EventConfig {
  icon: React.ElementType;
  label: string;
  badgeVariant: BadgeProps["variant"];
  severity: "info" | "warn" | "danger" | "success";
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  exam_join: {
    icon: LogIn,
    label: "Joined exam",
    badgeVariant: "info",
    severity: "info",
  },
  exam_exit: {
    icon: LogOut,
    label: "Exited exam",
    badgeVariant: "default",
    severity: "info",
  },
  exam_submit: {
    icon: CheckCircle2,
    label: "Submitted exam",
    badgeVariant: "success",
    severity: "success",
  },
  tab_switch: {
    icon: Eye,
    label: "Tab switch",
    badgeVariant: "destructive",
    severity: "danger",
  },
  fullscreen_exit: {
    icon: Maximize,
    label: "Left fullscreen",
    badgeVariant: "destructive",
    severity: "danger",
  },
  copy_attempt: {
    icon: ClipboardCopy,
    label: "Copy attempt",
    badgeVariant: "warning",
    severity: "warn",
  },
  paste_attempt: {
    icon: ClipboardPaste,
    label: "Paste attempt",
    badgeVariant: "warning",
    severity: "warn",
  },
  right_click: {
    icon: MousePointerClick,
    label: "Right-click",
    badgeVariant: "warning",
    severity: "warn",
  },
  code_run_all: {
    icon: Play,
    label: "Run all test cases",
    badgeVariant: "info",
    severity: "info",
  },
  code_run_testcase: {
    icon: Play,
    label: "Run test case",
    badgeVariant: "info",
    severity: "info",
  },
  code_run_console: {
    icon: Terminal,
    label: "Console run",
    badgeVariant: "info",
    severity: "info",
  },
  code_autosave: {
    icon: Save,
    label: "Auto-saved",
    badgeVariant: "default",
    severity: "info",
  },
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
        ? `Q${entry.questionNumber} - TC #${d.testCaseIndex ?? "?"}`
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
    fullscreen_exit: logs.filter((l) => l.activityType === "fullscreen_exit")
      .length,
    copy_attempt: logs.filter((l) => l.activityType === "copy_attempt").length,
    paste_attempt: logs.filter((l) => l.activityType === "paste_attempt")
      .length,
    code_run_all: logs.filter((l) => l.activityType === "code_run_all").length,
    code_run_testcase: logs.filter(
      (l) => l.activityType === "code_run_testcase",
    ).length,
    code_run_console: logs.filter((l) => l.activityType === "code_run_console")
      .length,
    exam_join: logs.filter((l) => l.activityType === "exam_join").length,
  };

  const suspicious =
    counts.tab_switch +
    counts.fullscreen_exit +
    counts.copy_attempt +
    counts.paste_attempt;

  const codeRuns =
    counts.code_run_all + counts.code_run_testcase + counts.code_run_console;

  return (
    <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
      {suspicious > 0 && (
        <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {suspicious} suspicious event{suspicious > 1 ? "s" : ""} detected
        </div>
      )}
      <StatPill
        icon={Eye}
        label="Tab switches"
        value={counts.tab_switch}
        variant={counts.tab_switch > 0 ? "destructive" : "default"}
      />
      <StatPill
        icon={ClipboardCopy}
        label="Copy/Paste"
        value={counts.copy_attempt + counts.paste_attempt}
        variant={
          counts.copy_attempt + counts.paste_attempt > 0 ? "warning" : "default"
        }
      />
      <StatPill
        icon={LogIn}
        label="Joins"
        value={counts.exam_join}
        variant="info"
      />
      <StatPill icon={Play} label="Code runs" value={codeRuns} variant="info" />
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  variant: BadgeProps["variant"];
}) {
  return (
    <Badge
      variant={variant}
      className="justify-start px-3 py-2 rounded-md text-xs"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      <span className="font-bold">{value}</span>
    </Badge>
  );
}

export default function StudentActivityDialog({
  sessionId,
  student,
  onClose,
}: Props) {
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
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {student?.avatar ? (
              <img
                src={student.avatar}
                alt={student.name}
                className="w-10 h-10 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm">
                {student?.name?.charAt(0) ?? "?"}
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                {student?.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {student?.email}
                {student?.studentId && ` · MSSV ${student.studentId}`}
              </p>
            </div>
          </div>

          {/* Submission summary */}
          {submission && (
            <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
              <Badge variant={submission.isSubmitted ? "success" : "warning"}>
                {submission.isSubmitted ? "Submitted" : "Not submitted"}
              </Badge>
              <span className="text-muted-foreground">
                Score:{" "}
                <strong className="text-foreground">
                  {(submission.finalScore ?? 0).toFixed(1)}/10
                </strong>
              </span>
              <span className="text-muted-foreground">
                Code #{submission.examCodeNumber}
              </span>
              {submission.submittedAt && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(submission.submittedAt).toLocaleTimeString(
                    "vi-VN",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    },
                  )}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No activity recorded for this student.
            </div>
          ) : (
            <>
              <SeverityStats logs={logs} />

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

                <div className="space-y-2">
                  {logs.map((entry, idx) => {
                    const cfg = EVENT_CONFIG[entry.activityType];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    const detail = formatDetail(entry);
                    return (
                      <div
                        key={entry._id ?? idx}
                        className="flex gap-3 items-start relative"
                      >
                        {/* Dot */}
                        <div className="shrink-0 w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center z-10">
                          <Icon
                            className={`w-3.5 h-3.5 ${
                              cfg.severity === "danger"
                                ? "text-destructive"
                                : cfg.severity === "warn"
                                  ? "text-warning"
                                  : cfg.severity === "success"
                                    ? "text-success"
                                    : "text-muted-foreground"
                            }`}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 px-3 py-2 rounded-md border border-border bg-card min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">
                              {cfg.label}
                            </span>
                            <span className="text-muted-foreground shrink-0 font-mono">
                              {formatTs(entry.timestamp)}
                            </span>
                          </div>
                          {detail && (
                            <p className="text-muted-foreground mt-0.5">
                              {detail}
                            </p>
                          )}
                          {entry.ipAddress && (
                            <p className="text-muted-foreground mt-0.5 font-mono text-[10px] truncate">
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
      </DialogContent>
    </Dialog>
  );
}
