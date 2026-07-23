import { useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { authAPI, examSessionAPI } from "~/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import {
  LogOut,
  BookOpen,
  Trophy,
  Clock,
  Loader2Icon,
  Computer,
  Search,
  KeyRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import Logo from "~/assets/Logo.png";
import { useState } from "react";
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
import JavaIcon from "~/assets/java.png";
import { toast } from "sonner";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useUserStore();
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [computerOrder, setComputerOrder] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  
  // Room code search states
  const [roomCode, setRoomCode] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  // Fetch user info
  useEffect(() => {
    authAPI
      .getUser()
      .then((res) => {
        if (res.data.role !== "student") {
          navigate("/lecturer");
        } else {
          setUser(res.data);
        }
      })
      .catch(() => {
        navigate("/");
      });
  }, [navigate, setUser]);

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2Icon className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  const handleJoinExam = async () => {
    if (!selectedExam) return;

    if (!accessKey.trim()) {
      setError("Please enter the access key");
      return;
    }

    // Only validate computerOrder if student hasn't entered one before
    if (!selectedExam.hasComputerOrder) {
      if (!computerOrder || isNaN(Number(computerOrder)) || Number(computerOrder) < 1) {
        setError("Please enter a valid computer order number");
        return;
      }
    }

    setIsJoining(true);
    setError("");

    try {
      const response = await examSessionAPI.joinWaitingList(selectedExam.roomCode, {
        computerOrder: selectedExam.hasComputerOrder ? undefined : Number(computerOrder),
        accessKey: accessKey.trim(),
      });
      const { directEntry, sessionId } = response.data;

      if (directEntry) {
        navigate(`/student/exam/${sessionId}`);
      } else {
        toast.success("Joined waiting list. Please wait for lecturer approval.");
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
        setRoomCode(""); // Clear the input after successful search
      }
    } catch (err: any) {
      setSearchError(
        err.response?.data?.error || "Exam not found. Please check the room code."
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 font-bold text-gray-900 text-2xl items-center">
              <div className="size-12 rounded">
                <img src={Logo} alt="Derit" className="w-full h-full" />
              </div>
              <span>Derit</span>
            </div>

            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 hover:bg-blue-100 px-3 py-2 rounded cursor-pointer">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500">{user.studentId}</p>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="flex  justify-center items-center">
                  <div
                    onClick={handleLogout}
                    className="cursor-pointer text-red-500 flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-5xl flex-1 flex flex-col  items-center mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Room Code Search */}
        <div className="bg-white rounded-md border border-gray-100 p-6 w-full mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Join by Room Code</h2>

          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSearchByRoomCode()
                }
                className="text-lg tracking-wider"
              />
            </div>
            <Button
              onClick={handleSearchByRoomCode}
              disabled={isSearching || !roomCode.trim()}
              className="bg-primary hover:bg-primary/80 cursor-pointer"
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
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {searchError}
            </div>
          )}
        </div>

        {/* Available Exams */}
        <div className="bg-white rounded-md border border-gray-100 p-6 w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Available</h2>

            <Button
              className="shadow-none cursor-pointer"
              variant="outline"
              size="sm"
              onClick={() => refetchExams()}
            >
              {isFetching ? (
                <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Reload
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2Icon className="animate-spin h-12 w-12 text-primary" />
            </div>
          ) : availableExams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-2xl font-semibold">
                No exams available
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableExams.map((exam: any) => (
                <div
                  key={exam._id}
                  onClick={() => {
                    if (!exam.isSubmitted) setSelectedExam(exam);
                  }}
                  className={`select-none ${exam.isSubmitted ? "cursor-not-allowed" : "cursor-pointer"} flex gap-4 p-4 border rounded-md transition-all ${
                    exam.isSubmitted
                      ? "border-gray-200 bg-gray-50/50"
                      : exam.isPending
                        ? "border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50"
                        : "border-blue-200 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  <img src={JavaIcon} alt="Exam" className="w-16 h-16 " />
                  <div className="flex justify-between flex-1 items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-xl text-gray-900 mb-1">
                        {exam.sessionName}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {exam.examTemplateId?.examName}
                      </p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>
                          Duration: {exam.examTemplateId?.duration} minutes
                        </span>
                        <span>Teacher: {exam.createdBy?.name || "Unknown"}</span>
                        <span>
                          Start:{" "}
                          {new Date(exam.startTime).toLocaleString("vi-VN")}
                        </span>
                      </div>
                    </div>
                    <div>
                      {exam.isSubmitted ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Submitted
                        </span>
                      ) : exam.isPending ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1.5">
                          <Loader2Icon className="h-3 w-3 animate-spin" />
                          Pending Approval
                        </span>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            exam.status === "ongoing"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-primary"
                          }`}
                        >
                          {exam.status === "ongoing" ? "Ongoing" : "Scheduled"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                <DialogDescription>
                  {selectedExam && (
                    <div className="rounded px-2 font-semibold flex flex-col gap-2 mx-auto text-start w-full">
                      <img
                        src={JavaIcon}
                        alt="Exam"
                        className="size-12 mb-2 mx-auto"
                      />
                      <p className="font-semibold text-center text-2xl text-gray-900 mb-4">
                        {selectedExam.sessionName}
                      </p>

                      <div className="text-gray-600 text-sm flex items-center justify-between gap-2">
                        <span>Start Time</span>
                        <span>
                          {new Date(selectedExam.startTime).toLocaleString(
                            "vi-VN",
                          )}{" "}
                        </span>
                      </div>
                      <div className="text-gray-600 text-sm flex items-center justify-between gap-2">
                        <span>End Time</span>
                        <span>
                          {new Date(selectedExam.endTime).toLocaleString(
                            "vi-VN",
                          )}
                        </span>
                      </div>
                      <div className="text-gray-600 text-sm flex items-center justify-between gap-2">
                        <span>Duration</span>
                        <span>
                          {selectedExam.examTemplateId?.duration} minutes
                        </span>
                      </div>
                      <div className="text-gray-600 text-sm flex items-center justify-between gap-2">
                        <span>Author</span>
                        <span>{selectedExam?.createdBy?.name || "Unknown"}</span>
                      </div>
                    </div>
                  )}
                </DialogDescription>
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
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={handleJoinExam}
                  disabled={isJoining}
                  className="bg-primary hover:bg-primary/80 py-6 text-md cursor-pointer w-full"
                >
                  {isJoining ? "Joining..." : "Join Exam"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
