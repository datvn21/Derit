import { Link, useNavigate } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { examSessionAPI } from "~/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import {
  ArrowLeft,
  Plus,
  Calendar,
  DoorOpen,
  Clock,
  CheckCircle,
  Search,
  StopCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";

// SessionCard component — hooks called at top level
function SessionCard({
  session,
  onNavigate,
}: {
  session: any;
  onNavigate: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  const startMutation = useMutation({
    mutationFn: () => examSessionAPI.start(session._id),
    onSuccess: () => {
      toast.success("Session started");
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      queryClient.invalidateQueries({
        queryKey: ["exam-session", session._id],
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to start session");
    },
  });

  const endMutation = useMutation({
    mutationFn: () => examSessionAPI.end(session._id),
    onSuccess: () => {
      toast.success("Session ended");
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      queryClient.invalidateQueries({
        queryKey: ["exam-session", session._id],
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to end session");
    },
  });

  const statusBadge: Record<string, string> = {
    scheduled: "bg-blue-100 text-primary",
    ongoing: "bg-green-100 text-green-700",
    ended: "bg-red-100 text-red-600",
    graded: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">
              {session.sessionName}
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded capitalize ${statusBadge[session.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {session.status}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
            <span>Room:</span>
            <span> {session.roomCode}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
            <span>Start Time:</span>
            <span>
              {new Date(session.startTime).toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
            <span>End Time:</span>
            <span>
              {new Date(session.endTime).toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
          {session.status === "scheduled" && (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                startMutation.mutate();
              }}
              disabled={startMutation.isPending}
              className="text-white bg-green-500 hover:bg-green-700 cursor-pointer flex-1"
            >
              {startMutation.isPending ? "Starting..." : "Start"}
            </Button>
          )}

          {session.status === "ongoing" && (
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                setEndDialogOpen(true);
              }}
              disabled={endMutation.isPending}
              className="text-white bg-red-500 hover:bg-red-700 cursor-pointer flex-1"
            >
              {endMutation.isPending ? "Ending..." : "End"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              navigate(`/lecturer/exam-sessions/${session._id}`);
            }}
            className="cursor-pointer flex-1"
          >
            Details
          </Button>
        </div>
      </div>

      {/* End Session Confirm Dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <StopCircle className="w-5 h-5" />
              End Session
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to end{" "}
              <strong>"{session.sessionName}"</strong>? Students will no longer be able to submit code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEndDialogOpen(false)}
              disabled={endMutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => { endMutation.mutate(); setEndDialogOpen(false); }}
              disabled={endMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              {endMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ending...</>
              ) : (
                <><StopCircle className="w-4 h-4 mr-2" />End Session</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ExamSessionList() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => examSessionAPI.getAll(),
    enabled: !!user,
  });

  const sessions = sessionsData?.data?.sessions || [];
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return sessions.filter(
      (s: any) =>
        s.sessionName.toLowerCase().includes(q) ||
        (s.roomCode && s.roomCode.toLowerCase().includes(q)),
    );
  }, [sessions, query]);

  const scheduled = filtered.filter((s: any) => s.status === "scheduled");
  const ongoing = filtered.filter((s: any) => s.status === "ongoing");
  const ended = filtered.filter((s: any) => s.status === "ended");
  const graded = filtered.filter((s: any) => s.status === "graded");

  return (
    <div className="min-h-screen bg-gray-50">
      <header>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Exam Sessions</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary w-52"
                />
              </div>
              <Button
                onClick={() => navigate("/lecturer/exam-sessions/create")}
                className="bg-primary hover:bg-primary/80 text-white cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Session
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-blue-300 border-t-transparent animate-spin"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No sessions yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first exam session to get started
            </p>
            <Button
              onClick={() => navigate("/lecturer/exam-sessions/create")}
              className="bg-primary hover:bg-primary/80 text-white cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Session
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {ongoing.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-black mb-4">
                  Ongoing - {ongoing.length}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ongoing.map((session: any) => (
                    <SessionCard
                      key={session._id}
                      session={session}
                      onNavigate={navigate}
                    />
                  ))}
                </div>
              </div>
            )}

            {scheduled.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-600 mb-4">
                  Scheduled - {scheduled.length}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {scheduled.map((session: any) => (
                    <SessionCard
                      key={session._id}
                      session={session}
                      onNavigate={navigate}
                    />
                  ))}
                </div>
              </div>
            )}

            {ended.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-red-600">
                  Ended - {ended.length}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ended.map((session: any) => (
                    <SessionCard
                      key={session._id}
                      session={session}
                      onNavigate={navigate}
                    />
                  ))}
                </div>
              </div>
            )}

            {graded.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Graded ({graded.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {graded.map((session: any) => (
                    <SessionCard
                      key={session._id}
                      session={session}
                      onNavigate={navigate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
