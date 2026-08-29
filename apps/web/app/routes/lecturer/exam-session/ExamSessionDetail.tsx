import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { examSessionAPI, BACKEND_URL } from "~/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import StudentActivityDialog from "~/components/StudentActivityDialog";
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Trash2,
  Play,
  Copy,
  FileText,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatToLocalDateTime,
  stripUniversityDomain,
  STATUS_VARIANT_MAP,
  withUniversityDomain,
} from "./Detail/helpers";
import { recordRecentItem } from "~/lib/recents";

export default function ExamSessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Student activity log viewer
  const [activityStudent, setActivityStudent] = useState<{
    _id: string;
    name: string;
    email: string;
    studentId?: string;
    avatar?: string;
  } | null>(null);

  // Form states
  const [sessionName, setSessionName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [whitelist, setWhitelist] = useState("");
  const [blacklist, setBlacklist] = useState("");

  // Load session data
  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["exam-session", id],
    queryFn: () => examSessionAPI.getById(id!),
    enabled: !!id,
  });

  // Fill form when data loads
  useEffect(() => {
    if (sessionData?.data?.session) {
      const session = sessionData.data.session;

      recordRecentItem({
        type: "Session",
        name: session.sessionName,
        href: `/lecturer/exam-sessions/${id}`,
      });

      setSessionName(session.sessionName);
      setStartTime(formatToLocalDateTime(session.startTime));
      setEndTime(formatToLocalDateTime(session.endTime));
      setAccessKey(session.accessKey || "");
      setWhitelist(stripUniversityDomain(session.whitelist || []).join("\n"));
      setBlacklist(stripUniversityDomain(session.blacklist || []).join("\n"));
    }
  }, [sessionData]);

  // Load students list
  const { data: studentsData } = useQuery({
    queryKey: ["session-students", id],
    queryFn: () => examSessionAPI.getStudents(id!),
    enabled: !!id,
  });

  // Load waiting list
  const { data: waitingData, refetch: refetchWaiting } = useQuery({
    queryKey: ["session-waiting", id],
    queryFn: () => examSessionAPI.getWaitingList(id!),
    enabled: !!id,
  });

  // SSE for Realtime Updates
  useEffect(() => {
    if (!id) return;
    const eventSource = new EventSource(
      `${BACKEND_URL}/exam-sessions/${id}/live`,
      {
        withCredentials: true,
      },
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "UPDATE") {
          queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
          queryClient.invalidateQueries({ queryKey: ["session-students", id] });
          queryClient.invalidateQueries({ queryKey: ["session-waiting", id] });
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [id, queryClient]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => examSessionAPI.update(id!, data),
    onSuccess: () => {
      toast.success("Session updated successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update session");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => examSessionAPI.delete(id!),
    onSuccess: () => {
      toast.success("Session deleted successfully");
      navigate("/lecturer/exam-sessions");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete session");
    },
  });

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: () => examSessionAPI.start(id!),
    onSuccess: () => {
      toast.success("Session started");
      queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to start session");
    },
  });

  // End session mutation
  const endMutation = useMutation({
    mutationFn: () => examSessionAPI.end(id!),
    onSuccess: () => {
      toast.success("Session ended");
      queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to end session");
    },
  });

  // Approve waiting student mutation
  const approveWaitingMutation = useMutation({
    mutationFn: (studentId: string) =>
      examSessionAPI.approveWaitingStudent(id!, studentId),
    onSuccess: () => {
      toast.success("Student approved");
      refetchWaiting();
      queryClient.invalidateQueries({ queryKey: ["session-students", id] });
      queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to approve student");
    },
  });

  // Approve all waiting students mutation
  const approveAllWaitingMutation = useMutation({
    mutationFn: () => examSessionAPI.approveAllWaiting(id!),
    onSuccess: () => {
      toast.success("All waiting students approved");
      refetchWaiting();
      queryClient.invalidateQueries({ queryKey: ["session-students", id] });
      queryClient.invalidateQueries({ queryKey: ["exam-session", id] });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error || "Failed to approve all students",
      );
    },
  });

  const handleUpdate = () => {
    if (!sessionName.trim()) {
      toast.error("Session name is required");
      return;
    }

    if (!accessKey.trim()) {
      toast.error("Access key is required");
      return;
    }

    // Transform student IDs to full emails
    const transformEmails = (text: string) =>
      text
        .split("\n")
        .map((e) => e.trim())
        .filter((e) => e)
        .map(withUniversityDomain);

    updateMutation.mutate({
      sessionName,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      accessKey,
      whitelist: transformEmails(whitelist),
      blacklist: transformEmails(blacklist),
    });
  };

  const handleDelete = () => {
    if (
      confirm(
        "Are you sure you want to delete this session? This action cannot be undone.",
      )
    ) {
      deleteMutation.mutate();
    }
  };

  const handleCopyRoomCode = () => {
    if (session?.roomCode) {
      navigator.clipboard.writeText(session.roomCode);
      toast.success("Room code copied to clipboard");
    }
  };

  const handleCopyAccessKey = () => {
    if (session?.accessKey) {
      navigator.clipboard.writeText(session.accessKey);
      toast.success("Access key copied to clipboard");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const session = sessionData?.data?.session;
  const students = studentsData?.data?.students || [];

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Session not found</p>
          <Button onClick={() => navigate("/lecturer/exam-sessions")}>
            Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  const canEdit =
    session.status === "scheduled" || session.status === "ongoing";
  const canDelete = session.status === "scheduled";
  const canStart = session.status === "scheduled";
  const canEnd = session.status === "ongoing";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-xs">
        <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-center px-4 sm:px-6">
          <div className="absolute left-4 flex min-w-0 justify-start sm:left-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/lecturer/exam-sessions")}
              className="h-8 rounded-md border border-border bg-muted/70 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Button>
          </div>

          <h1 className="min-w-0 max-w-[46vw] truncate text-center text-base font-semibold tracking-tight text-foreground sm:max-w-[56vw]">
            {session.sessionName}
          </h1>

          <div className="absolute right-4 flex min-w-0 items-center justify-end gap-2 sm:right-6">
            {/* View Results button */}
            {(session.status === "ended" || session.status === "graded") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/lecturer/exam-sessions/${id}/results`)
                }
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Results
              </Button>
            )}

            {canStart && (
              <Button
                size="sm"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                Start Session
              </Button>
            )}

            {canEnd && (
              <Button
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to end this session? Students will no longer be able to submit.",
                    )
                  ) {
                    endMutation.mutate();
                  }
                }}
                disabled={endMutation.isPending}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <div className="w-3 aspect-square rounded-xs bg-primary-foreground"></div>
                End Session
              </Button>
            )}

            {canEdit && !isEditing && (
              <Button
                size="sm"
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}

            {isEditing && (
              <>
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
              </>
            )}

            {canDelete && (
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                variant="outline"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session Details Card */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Session Details
              </h2>

              <div className="space-y-4">
                {/* Room Code */}
                <div className="flex items-center justify-between p-4 bg-accent rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Room Code</p>
                      <p className="text-xl font-mono font-bold text-primary">
                        {session.roomCode}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyRoomCode}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>

                {/* Template Info */}
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      Exam Template
                    </p>
                  </div>
                  <p className="text-foreground">
                    {session.examTemplateId?.templateName}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <span>Type: {session.examTemplateId?.examType}</span>
                    <span>Language: {session.examTemplateId?.language}</span>
                    <span>
                      Duration: {session.examTemplateId?.duration} min
                    </span>
                  </div>
                </div>
                {/* Session Name */}
                <div className="flex w-full justify-between gap-2">
                  <Label htmlFor="sessionName" className="min-w-[100px]">
                    Session Name
                  </Label>
                  {isEditing ? (
                    <Input
                      id="sessionName"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className="mt-1 flex-1"
                    />
                  ) : (
                    <p className="mt-1 text-foreground">
                      {session.sessionName}
                    </p>
                  )}
                </div>
                {/* Schedule */}
                <div className="flex w-full justify-between gap-2">
                  <Label
                    htmlFor="startTime"
                    className="flex items-center gap-2 min-w-[100px]"
                  >
                    Start Time
                  </Label>
                  {isEditing ? (
                    <Input
                      id="startTime"
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1  flex-1"
                    />
                  ) : (
                    <p className="mt-1 text-foreground">
                      {new Date(session.startTime).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>

                <div className="flex w-full justify-between gap-2">
                  <Label
                    htmlFor="endTime"
                    className="flex items-center gap-2 min-w-[100px]"
                  >
                    End Time
                  </Label>
                  {isEditing ? (
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="mt-1 flex-1"
                    />
                  ) : (
                    <p className="mt-1 text-foreground">
                      {new Date(session.endTime).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>

                {/* Access Key */}
                <div className="flex w-full justify-between gap-2">
                  <Label
                    htmlFor="accessKey"
                    className="flex items-center gap-2 min-w-[100px]"
                  >
                    Access Key
                  </Label>
                  {isEditing ? (
                    <Input
                      id="accessKey"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      className="mt-1 flex-1"
                    />
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <code className="px-3 py-2 bg-muted rounded border border-border font-mono text-sm">
                        {session.accessKey}
                      </code>
                      <Button
                        onClick={handleCopyAccessKey}
                        variant="ghost"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Whitelist */}
                <div className="space-y-2">
                  <Label
                    htmlFor="whitelist"
                    className="text-xs font-semibold text-foreground block"
                  >
                    Whitelist
                  </Label>
                  {isEditing ? (
                    <Textarea
                      id="whitelist"
                      value={whitelist}
                      onChange={(e) => setWhitelist(e.target.value)}
                      placeholder="One email per line"
                      rows={4}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div>
                      {session.whitelist?.length > 0 ? (
                        <div className="p-3 bg-muted rounded border border-border max-h-32 overflow-y-auto">
                          {session.whitelist.map((email: string, i: number) => (
                            <p
                              key={i}
                              className="text-sm text-foreground font-mono"
                            >
                              {email}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          All students allowed
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Blacklist */}
                <div className="space-y-2">
                  <Label
                    htmlFor="blacklist"
                    className="text-xs font-semibold text-foreground block"
                  >
                    Blacklist
                  </Label>
                  {isEditing ? (
                    <Textarea
                      id="blacklist"
                      value={blacklist}
                      onChange={(e) => setBlacklist(e.target.value)}
                      placeholder="One email per line"
                      rows={3}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div>
                      {session.blacklist?.length > 0 ? (
                        <div className="p-3 bg-muted rounded border border-border max-h-32 overflow-y-auto">
                          {session.blacklist.map((email: string, i: number) => (
                            <p
                              key={i}
                              className="text-sm text-foreground font-mono"
                            >
                              {email}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No blacklisted students
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Statistics Card */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Statistics
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Entry Mode
                  </span>
                  <Badge
                    variant={session.entryMode === "open" ? "success" : "info"}
                  >
                    {session.entryMode === "open" ? "Open" : "Approval"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Waiting for Approval
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {waitingData?.data?.waitingStudents?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Joined</span>
                  <span className="text-lg font-bold text-foreground">
                    {students.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-warning"></span>
                    In Progress
                  </span>
                  <span className="text-lg font-bold text-warning">
                    {students.filter((s: any) => !s.isSubmitted).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                    Submitted
                  </span>
                  <span className="text-lg font-bold text-success">
                    {students.filter((s: any) => s.isSubmitted).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={STATUS_VARIANT_MAP[session.status] ?? "default"}
                    className="capitalize"
                  >
                    {session.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Waiting List Card */}
            {(waitingData?.data?.waitingStudents?.length || 0) > 0 && (
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    Waiting {waitingData?.data?.waitingStudents?.length}
                  </h2>
                  <Button
                    onClick={() => approveAllWaitingMutation.mutate()}
                    disabled={approveAllWaitingMutation.isPending}
                    size="sm"
                  >
                    Approve All
                  </Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {waitingData?.data?.waitingStudents?.map((student: any) => (
                    <div
                      key={student._id}
                      className="p-3 bg-muted rounded border border-border flex items-center justify-between"
                    >
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm text-foreground">
                          {student.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.email}
                        </p>
                        {student.computerOrder != null && (
                          <p className="text-xs text-warning mt-0.5 font-medium">
                            Order: {student.computerOrder}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            approveWaitingMutation.mutate(student._id)
                          }
                          disabled={approveWaitingMutation.isPending}
                          size="sm"
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Students List Card */}
            <div className="bg-card rounded-lg border border-border p-6">
              <div className="text-lg font-semibold text-foreground mb-4 flex justify-between ">
                <span>Joined Students</span>{" "}
                <span className="tracking-wider text-foreground">
                  {students.filter((s: any) => s.isSubmitted).length}/
                  {students.length}
                </span>
              </div>
              {students.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {students.map((item: any) => (
                    <div
                      key={item.student._id}
                      className="p-3 bg-muted rounded border border-border hover:border-foreground/20 cursor-pointer transition-colors group"
                      onClick={() =>
                        setActivityStudent({
                          _id: item.student._id,
                          name: item.student.name,
                          email: item.student.email,
                          studentId: item.student.studentId,
                          avatar: item.student.avatar,
                        })
                      }
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-foreground">
                            {item.computerOrder
                              ? `${item.computerOrder} - `
                              : ""}{" "}
                            {item.student.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.student.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.isSubmitted && (
                            <Badge variant="success">Submitted</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <div className="flex gap-4">
                          <p className="text-xs font-medium text-primary py-1 rounded">
                            Code: {item.examCodeNumber}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground py-1 rounded">
                            Joins: {item.joinCount || 0}
                          </span>
                          <span
                            className={`text-[11px] font-medium py-1 rounded ${
                              (item.tabSwitchCount || 0) > 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            Tab switch: {item.tabSwitchCount || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No students joined yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Student Activity Log Dialog ── */}
      {id && (
        <StudentActivityDialog
          sessionId={id}
          student={activityStudent}
          onClose={() => setActivityStudent(null)}
        />
      )}
    </div>
  );
}
