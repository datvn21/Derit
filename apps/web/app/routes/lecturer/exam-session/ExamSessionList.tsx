/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4
 * genre: modern-minimal · macrostructure: App Dashboard · design-system: design.md · designed-as-app
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { examSessionAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Plus,
  Calendar,
  Search,
  StopCircle,
  Play,
  FileText,
  BarChart2,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { ViewToggle, type ViewMode } from "~/components/ui/view-toggle";
import { EmptyState } from "~/components/ui/empty-state";
import { ConfirmDeleteDialog } from "~/components/ui/confirm-delete-dialog";
import { PageLoading } from "~/components/ui/page-loading";

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ongoing", label: "Ongoing" },
  { value: "ended", label: "Ended" },
  { value: "graded", label: "Graded" },
] as const;

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge variant="info">Scheduled</Badge>;
    case "ongoing":
      return <Badge variant="success">Ongoing</Badge>;
    case "ended":
      return <Badge variant="destructive">Ended</Badge>;
    case "graded":
      return <Badge variant="default">Graded</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export default function ExamSessionList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => examSessionAPI.getAll(),
    enabled: !!user,
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState("");

  // End session dialog state
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endTargetId, setEndTargetId] = useState<string | null>(null);
  const [endTargetName, setEndTargetName] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examSessionAPI.delete(id),
    onSuccess: () => {
      toast.success("Session deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete session");
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => examSessionAPI.start(id),
    onSuccess: () => {
      toast.success("Session started");
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to start session");
    },
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => examSessionAPI.end(id),
    onSuccess: () => {
      toast.success("Session ended");
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to end session");
    },
  });

  const handleOpenDelete = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    deleteMutation.mutate(deleteTargetId);
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  const handleOpenEnd = (id: string, name: string) => {
    setEndTargetId(id);
    setEndTargetName(name);
    setEndDialogOpen(true);
  };

  const handleConfirmEnd = () => {
    if (!endTargetId) return;
    endMutation.mutate(endTargetId);
    setEndDialogOpen(false);
    setEndTargetId(null);
  };

  const sessions = sessionsData?.data?.sessions || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s: any) => {
      if (
        q &&
        !s.sessionName?.toLowerCase().includes(q) &&
        !s.roomCode?.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [sessions, query, statusFilter]);

  const hasActiveFilter = !!query || statusFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
  };

  if (isLoading) {
    return <PageLoading label="Loading exam sessions…" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Page header - title + create action */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Exam Sessions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
              {hasActiveFilter && ` · ${filtered.length} shown`}
            </p>
          </div>
          <Button
            onClick={() => navigate("/lecturer/exam-sessions/create")}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Session
          </Button>
        </div>

        {/* Toolbar */}
        <SessionToolbar
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <div className="flex justify-start">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={hasActiveFilter ? Search : Calendar}
            title={hasActiveFilter ? "No matching sessions" : "No sessions yet"}
            description={
              hasActiveFilter
                ? query
                  ? `No sessions match "${query}".`
                  : "No sessions match the current filters."
                : "Create your first exam session to get started."
            }
            action={
              hasActiveFilter ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear filters
                </Button>
              ) : (
                <Button
                  onClick={() => navigate("/lecturer/exam-sessions/create")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Session
                </Button>
              )
            }
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((session: any) => (
              <SessionCard
                key={session._id}
                session={session}
                onStart={() => startMutation.mutate(session._id)}
                isStarting={startMutation.isPending}
                onEnd={() => handleOpenEnd(session._id, session.sessionName)}
                onDelete={() =>
                  handleOpenDelete(session._id, session.sessionName)
                }
                onDetail={() =>
                  navigate(`/lecturer/exam-sessions/${session._id}`)
                }
                onResults={() =>
                  navigate(`/lecturer/exam-sessions/${session._id}/results`)
                }
              />
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden shadow-none">
            <Table>
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-28">Room Code</TableHead>
                  <TableHead className="w-40">Start Time</TableHead>
                  <TableHead className="w-40">End Time</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((session: any) => (
                  <SessionListRow
                    key={session._id}
                    session={session}
                    onStart={() => startMutation.mutate(session._id)}
                    isStarting={startMutation.isPending}
                    onEnd={() =>
                      handleOpenEnd(session._id, session.sessionName)
                    }
                    onDelete={() =>
                      handleOpenDelete(session._id, session.sessionName)
                    }
                    onDetail={() =>
                      navigate(`/lecturer/exam-sessions/${session._id}`)
                    }
                    onResults={() =>
                      navigate(`/lecturer/exam-sessions/${session._id}/results`)
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Session"
        description={
          <>
            Are you sure you want to delete{" "}
            <strong>"{deleteTargetName}"</strong>? This action cannot be undone.
          </>
        }
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />

      {/* End Session Confirm Dialog */}
      <ConfirmDeleteDialog
        open={endDialogOpen}
        onOpenChange={setEndDialogOpen}
        title="End Session"
        description={
          <>
            Are you sure you want to end <strong>"{endTargetName}"</strong>?
            Students will no longer be able to submit code.
          </>
        }
        confirmLabel="End Session"
        onConfirm={handleConfirmEnd}
        isDeleting={endMutation.isPending}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Toolbar                                      */
/* -------------------------------------------------------------------------- */

function SessionToolbar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search sessions by name or room code…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger
                className="w-[140px] h-9"
                aria-label="Filter by session status"
              >
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Card view                                    */
/* -------------------------------------------------------------------------- */

function SessionCard({
  session,
  onStart,
  isStarting,
  onEnd,
  onDelete,
  onDetail,
  onResults,
}: {
  session: any;
  onStart: () => void;
  isStarting: boolean;
  onEnd: () => void;
  onDelete: () => void;
  onDetail: () => void;
  onResults: () => void;
}) {
  const templateName =
    session.examTemplateId?.templateName || session.examTemplateId?.examName;
  const startTime = new Date(session.startTime).toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(session.endTime).toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="group shadow-none transition-colors hover:border-foreground/20 flex flex-col justify-between">
      <CardHeader className="flex-row items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0 space-y-1.5 flex-1">
          <h3
            className="truncate font-semibold leading-tight text-foreground"
            title={session.sessionName}
          >
            {session.sessionName}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge(session.status)}
            {session.roomCode && (
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {session.roomCode}
              </span>
            )}
          </div>
        </div>
        <SessionActions
          session={session}
          onStart={onStart}
          onEnd={onEnd}
          onDelete={onDelete}
          onResults={onResults}
        />
      </CardHeader>

      <CardContent className="space-y-2 p-5 pt-0 text-xs text-muted-foreground flex-1">
        {templateName && (
          <div className="flex items-center gap-1.5 truncate text-foreground font-medium">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{templateName}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-muted-foreground">Start:</span>
          <span className="text-foreground">{startTime}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">End:</span>
          <span className="text-foreground">{endTime}</span>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border p-3 gap-2">
        {session.status === "scheduled" && (
          <Button
            size="sm"
            onClick={onStart}
            disabled={isStarting}
            className="flex-1"
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            {isStarting ? "Starting…" : "Start"}
          </Button>
        )}
        {session.status === "ongoing" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onEnd}
            className="flex-1"
          >
            <StopCircle className="w-3.5 h-3.5 mr-1" />
            End
          </Button>
        )}
        {(session.status === "ended" || session.status === "graded") && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onResults}
            className="flex-1"
          >
            <BarChart2 className="w-3.5 h-3.5 mr-1" />
            Results
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onDetail}
          className="flex-1"
        >
          Details
        </Button>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                               List table                                   */
/* -------------------------------------------------------------------------- */

function SessionListRow({
  session,
  onStart,
  isStarting,
  onEnd,
  onDelete,
  onDetail,
  onResults,
}: {
  session: any;
  onStart: () => void;
  isStarting: boolean;
  onEnd: () => void;
  onDelete: () => void;
  onDetail: () => void;
  onResults: () => void;
}) {
  const templateName =
    session.examTemplateId?.templateName || session.examTemplateId?.examName;
  const startTime = new Date(session.startTime).toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(session.endTime).toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TableRow>
      <TableCell className="min-w-[260px]">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {session.sessionName}
          </p>
          {templateName && (
            <p className="truncate text-xs text-muted-foreground mt-0.5">
              {templateName}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground md:hidden">
            <span>Room: {session.roomCode || "-"}</span>
            <span aria-hidden="true">·</span>
            <span>{startTime}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 md:hidden">
            {getStatusBadge(session.status)}
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {getStatusBadge(session.status)}
      </TableCell>
      <TableCell className="hidden font-mono text-xs md:table-cell">
        {session.roomCode || "-"}
      </TableCell>
      <TableCell className="hidden text-muted-foreground text-xs md:table-cell">
        {startTime}
      </TableCell>
      <TableCell className="hidden text-muted-foreground text-xs md:table-cell">
        {endTime}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center justify-end gap-1">
          {session.status === "scheduled" && (
            <Button
              size="sm"
              onClick={onStart}
              disabled={isStarting}
              className="h-8 text-xs"
            >
              <Play className="w-3 h-3 mr-1" />
              Start
            </Button>
          )}
          {session.status === "ongoing" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onEnd}
              className="h-8 text-xs"
            >
              <StopCircle className="w-3 h-3 mr-1" />
              End
            </Button>
          )}
          {(session.status === "ended" || session.status === "graded") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onResults}
              className="h-8 text-xs"
            >
              <BarChart2 className="w-3 h-3 mr-1" />
              Results
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onDetail}
            className="h-8 text-xs"
          >
            Details
          </Button>
          <SessionActions
            session={session}
            onStart={onStart}
            onEnd={onEnd}
            onDelete={onDelete}
            onResults={onResults}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function SessionActions({
  session,
  onStart,
  onEnd,
  onDelete,
  onResults,
}: {
  session: any;
  onStart: () => void;
  onEnd: () => void;
  onDelete: () => void;
  onResults: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label="Session actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {session.status === "scheduled" && (
          <DropdownMenuItem onClick={onStart}>
            <Play className="h-4 w-4" />
            Start Session
          </DropdownMenuItem>
        )}
        {session.status === "ongoing" && (
          <DropdownMenuItem onClick={onEnd} className="text-destructive">
            <StopCircle className="h-4 w-4" />
            End Session
          </DropdownMenuItem>
        )}
        {(session.status === "ended" || session.status === "graded") && (
          <DropdownMenuItem onClick={onResults}>
            <BarChart2 className="h-4 w-4" />
            View Results
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
