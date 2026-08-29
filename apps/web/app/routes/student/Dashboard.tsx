/**
 * Student Dashboard.
 *
 * Wrapped in `AuthenticatedShell` so the three role surfaces (admin,
 * lecturer, student) share the same sidebar + nav + user-menu chrome.
 * The shell provides:
 *   - the top brand-mark + role label,
 *   - the active-state nav,
 *   - the user avatar dropdown with logout.
 * Pages must NOT roll their own header - doing so duplicates chrome
 * and breaks the layout (see screenshot bug 2026-07-23).
 *
 * Status differentiation is carried by the `Badge` primitive, not by
 * per-row tint (see audit M1).
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { authAPI, examSessionAPI } from "~/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRequireRole } from "~/hooks/useAuth";
import { Button } from "~/components/ui/button";
import {
  Gauge,
  Loader2Icon,
  Computer,
  Search,
  KeyRound,
  History,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { PageLoading } from "~/components/ui/page-loading";
import { toast } from "sonner";

function statusBadgeFor(exam: any) {
  if (exam.isSubmitted) return <Badge variant="destructive">Submitted</Badge>;
  if (exam.isPending)
    return (
      <Badge variant="warning">
        <Loader2Icon className="h-3 w-3 animate-spin" /> Pending Approval
      </Badge>
    );
  if (exam.status === "ongoing")
    return <Badge variant="success">Ongoing</Badge>;
  return <Badge variant="info">Scheduled</Badge>;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const user = useRequireRole("student");
  const { logout } = useUserStore();
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [computerOrder, setComputerOrder] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  // Room code search states
  const [roomCode, setRoomCode] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Fetch available exams
  const {
    data: examsData,
    isLoading,
    isFetching,
    refetch: refetchExams,
  } = useQuery({
    queryKey: ["available-exams"],
    queryFn: () => examSessionAPI.getAvailable(),
    enabled: !!user,
  });

  const handleLogout = async () => {
    await authAPI.logout();
    logout();
    navigate("/");
  };

  const availableExams = examsData?.data?.sessions || [];

  if (!user) {
    return <PageLoading label="Loading student dashboard…" />;
  }

  const handleJoinExam = async () => {
    if (!selectedExam) return;

    if (!accessKey.trim()) {
      setError("Please enter the access key");
      return;
    }

    if (!selectedExam.hasComputerOrder) {
      if (
        !computerOrder ||
        isNaN(Number(computerOrder)) ||
        Number(computerOrder) < 1
      ) {
        setError("Please enter a valid computer order number");
        return;
      }
    }

    setIsJoining(true);
    setError("");

    try {
      const response = await examSessionAPI.joinWaitingList(
        selectedExam.roomCode,
        {
          computerOrder: selectedExam.hasComputerOrder
            ? undefined
            : Number(computerOrder),
          accessKey: accessKey.trim(),
        },
      );
      const { directEntry, sessionId } = response.data;

      if (directEntry) {
        navigate(`/student/exam/${sessionId}`);
      } else {
        toast.success(
          "Joined waiting list. Please wait for lecturer approval.",
        );
        setSelectedExam(null);
        refetchExams();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to join exam");
    } finally {
      setIsJoining(false);
    }
  };

  const handleSearchByRoomCode = async () => {
    if (!roomCode.trim()) {
      setSearchError("Please enter a room code");
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      const response = await examSessionAPI.searchByRoomCode(roomCode.trim());
      const exam = response.data.session;

      if (exam) {
        setSelectedExam(exam);
        setRoomCode("");
      }
    } catch (err: any) {
      setSearchError(
        err.response?.data?.error ||
          "Exam not found. Please check the room code.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto w-full">
      {/* Page heading (shell owns brand + user-menu; this is just title) */}
      <header>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Welcome, {user.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Join an exam by room code or pick from the list below.
        </p>
      </header>

      {/* Room Code Search */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Join by Room Code
        </h2>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearchByRoomCode()}
              className="text-base tracking-wider h-10"
            />
          </div>
          <Button
            onClick={handleSearchByRoomCode}
            disabled={isSearching || !roomCode.trim()}
            size="default"
          >
            {isSearching ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>
        {searchError && (
          <div className="mt-3 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded text-sm">
            {searchError}
          </div>
        )}
      </section>

      {/* Available Exams */}
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-semibold text-foreground">
            Available Exams
          </h2>

          <Button variant="ghost" size="sm" onClick={() => refetchExams()}>
            {isFetching ? (
              <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Reload
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2Icon className="animate-spin h-10 w-10 text-muted-foreground" />
          </div>
        ) : availableExams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-base font-medium text-muted-foreground">
              No exams available
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              New exams will appear here once a lecturer schedules them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableExams.map((exam: any) => (
              <button
                key={exam._id}
                type="button"
                onClick={() => {
                  if (!exam.isSubmitted) setSelectedExam(exam);
                }}
                disabled={exam.isSubmitted}
                className={`group w-full text-left flex items-start gap-4 p-4 rounded-lg border transition-[border-color,background-color] duration-(--motion-fast) ease-(--motion-ease) ${
                  exam.isSubmitted
                    ? "border-border bg-muted opacity-60 cursor-not-allowed"
                    : "border-border bg-card hover:border-foreground/20 hover:bg-muted/50 cursor-pointer"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-base text-foreground">
                      {exam.sessionName}
                    </h3>
                    {statusBadgeFor(exam)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {exam.examTemplateId?.examName}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>
                      Duration: {exam.examTemplateId?.duration} minutes
                    </span>
                    <span>Teacher: {exam.createdBy?.name || "Unknown"}</span>
                    <span>
                      Start: {new Date(exam.startTime).toLocaleString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Join Exam Dialog */}
      <Dialog
        open={!!selectedExam}
        onOpenChange={() => {
          setSelectedExam(null);
          setComputerOrder("");
          setAccessKey("");
          setError("");
        }}
      >
        <DialogContent className="px-8 py-8" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle></DialogTitle>
            <div className="text-muted-foreground text-sm">
              {selectedExam && (
                <div className="rounded px-2 font-semibold flex flex-col gap-2 mx-auto text-start w-full">
                  <p className="font-semibold text-center text-xl text-foreground mb-4">
                    {selectedExam.sessionName}
                  </p>

                  <div className="text-muted-foreground text-sm flex items-center justify-between gap-2">
                    <span>Start Time</span>
                    <span>
                      {new Date(selectedExam.startTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-sm flex items-center justify-between gap-2">
                    <span>End Time</span>
                    <span>
                      {new Date(selectedExam.endTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-sm flex items-center justify-between gap-2">
                    <span>Duration</span>
                    <span>{selectedExam.examTemplateId?.duration} minutes</span>
                  </div>
                  <div className="text-muted-foreground text-sm flex items-center justify-between gap-2">
                    <span>Author</span>
                    <span>{selectedExam?.createdBy?.name || "Unknown"}</span>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="accessKey">
                <div>
                  <KeyRound className="size-4 ml-2" />
                </div>
                Access Key
              </Label>
              <Input
                id="accessKey"
                type="password"
                placeholder="Enter Access Key"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinExam()}
                autoFocus
              />
            </div>
            {!selectedExam?.hasComputerOrder && (
              <div className="space-y-2">
                <Label htmlFor="computerOrder">
                  <div>
                    <Computer className="size-4 ml-2" />
                  </div>
                  Computer Order
                </Label>
                <Input
                  id="computerOrder"
                  type="number"
                  min={1}
                  max={99}
                  placeholder="Enter Computer Order"
                  value={computerOrder}
                  onChange={(e) => setComputerOrder(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinExam()}
                />
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleJoinExam}
              disabled={isJoining}
              className="w-full"
              size="lg"
            >
              {isJoining ? "Joining..." : "Join Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
