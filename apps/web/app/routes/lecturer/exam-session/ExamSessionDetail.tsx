import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { examSessionAPI, submissionAPI, BACKEND_URL } from "~/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import StudentActivityDialog from "~/components/StudentActivityDialog";
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Trash2,
  Play,
  StopCircle,
  Copy,
  Users,
  Calendar,
  Key,
  Clock,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";

// Helper: Format UTC date to local datetime-local format (YYYY-MM-DDTHH:mm)
const formatToLocalDateTime = (utcDate: string | Date): string => {
  const date = new Date(utcDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
      
      // Strip @student.tdtu.edu.vn from emails for display
      const stripDomain = (emails: string[]) =>
        emails.map((e) =>
          e.endsWith("@student.tdtu.edu.vn")
            ? e.replace("@student.tdtu.edu.vn", "")
            : e
        );
      
      setSessionName(session.sessionName);
      setStartTime(formatToLocalDateTime(session.startTime));
      setEndTime(formatToLocalDateTime(session.endTime));
      setAccessKey(session.accessKey || "");
      setWhitelist(stripDomain(session.whitelist || []).join("\n"));
      setBlacklist(stripDomain(session.blacklist || []).join("\n"));
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
    const eventSource = new EventSource(`${BACKEND_URL}/exam-sessions/${id}/live`, {
      withCredentials: true,
    });

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
    mutationFn: (studentId: string) => examSessionAPI.approveWaitingStudent(id!, studentId),
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
      toast.error(error.response?.data?.error || "Failed to approve all students");
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
        .map((e) => (e.includes("@") ? e : `${e}@student.tdtu.edu.vn`));

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const session = sessionData?.data?.session;
  const students = studentsData?.data?.students || [];

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Session not found</p>
          <Button className="cursor-pointer" onClick={() => navigate("/lecturer/exam-sessions")}>
            Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  const canEdit = session.status === "scheduled" || session.status === "ongoing";
  const canDelete = session.status === "scheduled";
  const canStart = session.status === "scheduled";
  const canEnd = session.status === "ongoing";

  const statusColors = {
    scheduled: "bg-blue-100 text-blue-800",
    ongoing: "bg-yellow-100 text-yellow-800",
    ended: "bg-red-100 text-red-800",
    graded: "bg-green-100 text-green-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/lecturer/exam-sessions")}
                className="text-gray-600 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {session.sessionName}
                </h1>
               
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* View Results button */}
              {(session.status === "ended" || session.status === "graded") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/lecturer/exam-sessions/${id}/results`)}
                  className="cursor-pointer gap-1.5"
                >
                  <BarChart2 className="w-4 h-4" />
                  Results
                </Button>
              )}



              {canStart && (
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 cursor-pointer"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Session
                </Button>
              )}

              {canEnd && (
                <Button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to end this session? Students will no longer be able to submit.")) {
                      endMutation.mutate();
                    }
                  }}
                  disabled={endMutation.isPending}
                  className="bg-primary hover:bg-primary/80 cursor-pointer"
                >
                  <div className="w-3.5 aspect-square rounded bg-white"></div>
                  End Session
                </Button>
              )}

              {canEdit && !isEditing && (
                <Button className="cursor-pointer" onClick={() => setIsEditing(true)} variant="outline">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}

              {isEditing && (
                <>
                  <Button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    className="bg-primary hover:bg-primary/80 cursor-pointer"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button className="cursor-pointer" onClick={() => setIsEditing(false)} variant="outline">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}

              {canDelete && (
                <Button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session Details Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Session Details
              </h2>

              <div className="space-y-4">
                {/* Room Code */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    
                    <div>
                      <p className="text-sm text-gray-600">Room Code</p>
                      <p className="text-xl font-mono font-bold text-primary">
                        {session.roomCode}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyRoomCode}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>

               

                {/* Template Info */}
                <div className="p-4 bg-gray-100 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <p className="text-sm font-medium text-gray-700">
                      Exam Template
                    </p>
                  </div>
                  <p className="text-gray-900">
                    {session.examTemplateId?.templateName}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span>Type: {session.examTemplateId?.examType}</span>
                    <span>Language: {session.examTemplateId?.language}</span>
                    <span>
                      Duration: {session.examTemplateId?.duration} min
                    </span>
                  </div>
                </div>
 {/* Session Name */}
                <div className="flex w-full justify-between gap-2">
                  <Label  htmlFor="sessionName" className="min-w-[100px]">Session Name</Label>
                  {isEditing ? (
                    <Input
                      id="sessionName"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className="mt-1 flex-1"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{session.sessionName}</p>
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
                      <p className="mt-1 text-gray-900">
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
                      <p className="mt-1 text-gray-900">
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
                       
                      <code className="px-3 py-2 bg-gray-100 rounded border font-mono text-sm">
                        {session.accessKey}
                      </code>
                      <Button
                        onClick={handleCopyAccessKey}
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Whitelist */}
                <div>
                  <Label
                    htmlFor="whitelist"
                    className="flex items-center gap-2 mb-3"
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
                      className="mt-1 font-mono text-sm"
                    />
                  ) : (
                    <div className="mt-1">
                      {session.whitelist?.length > 0 ? (
                        <div className="p-3 bg-gray-50 rounded border  border-gray-200 max-h-32 overflow-y-auto">
                          {session.whitelist.map((email: string, i: number) => (
                            <p
                              key={i}
                              className="text-sm text-gray-700 font-mono"
                            >
                              {email}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          All students allowed
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Blacklist */}
                <div>
                  <Label
                    htmlFor="blacklist"
                    className="flex items-center gap-2"
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
                      className="mt-1 font-mono text-sm"
                    />
                  ) : (
                    <div className="mt-1">
                      {session.blacklist?.length > 0 ? (
                        <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-32 overflow-y-auto">
                          {session.blacklist.map((email: string, i: number) => (
                            <p
                              key={i}
                              className="text-sm text-gray-700 font-mono"
                            >
                              {email}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
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
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Statistics
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Entry Mode</span>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    session.entryMode === "open"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {session.entryMode === "open" ? "Open" : "Approval"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Waiting for Approval</span>
                  <span className="text-lg font-bold">
                    {waitingData?.data?.waitingStudents?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Joined</span>
                  <span className="text-lg font-bold text-black">
                    {students.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
                    In Progress
                  </span>
                  <span className="text-lg font-bold text-amber-600">
                    {students.filter((s: any) => !s.isSubmitted).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    Submitted
                  </span>
                  <span className="text-lg font-bold text-green-700">
                    {students.filter((s:any) => s.isSubmitted).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full capitalize ${statusColors[session.status as keyof typeof statusColors]}`}
                  >
                    {session.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Waiting List Card */}
            {(waitingData?.data?.waitingStudents?.length || 0) > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Waiting {waitingData?.data?.waitingStudents?.length}
                  </h2>
                  <Button
                    onClick={() => approveAllWaitingMutation.mutate()}
                    disabled={approveAllWaitingMutation.isPending}
                    className="bg-primary hover:bg-primary/80 text-white px-3 py-1 text-sm cursor-pointer"
                  >
                    Approve All
                  </Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {waitingData?.data?.waitingStudents?.map((student: any) => (
                    <div
                      key={student._id}
                      className="p-3 bg-gray-50 rounded border border-gray-200 flex items-center justify-between"
                    >
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm text-gray-900">
                          {student.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {student.email}
                        </p>
                        {student.computerOrder != null && (
                          <p className="text-xs text-orange-600 mt-0.5 font-medium">
                            Order: {student.computerOrder}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveWaitingMutation.mutate(student._id)}
                          disabled={approveWaitingMutation.isPending}
                          className="bg-primary hover:bg-primary/80 text-white px-2 py-1 text-xs cursor-pointer"
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
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-lg font-semibold text-gray-900 mb-4 flex justify-between ">
                <span>Joined Students</span> <span className="tracking-wider">{students.filter((s:any) => s.isSubmitted).length}/{students.length}</span> 
              </div>
                {students.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {students.map((item: any) => (
                    <div
                      key={item.student._id}
                      className="p-3 bg-gray-50 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer transition-colors group"
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
                          <p className="font-medium text-sm text-gray-900">
                            {item.computerOrder ? `${item.computerOrder} - ` : ""} {item.student.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {item.student.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.isSubmitted && (
                            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full border border-green-200">
                              Submitted
                            </span>
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
                          <span className="text-[11px] font-medium text-gray-700 py-1 rounded">
                            Joins: {item.joinCount || 0}
                          </span>
                          <span className={`text-[11px] font-medium py-1 rounded ${
                            (item.tabSwitchCount || 0) > 0 ? "text-red-600" : "text-gray-700"
                          }`}>
                            Tab switch: {item.tabSwitchCount || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic text-center py-4">
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
