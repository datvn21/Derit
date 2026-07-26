import { useState } from "react";
import { useNavigate } from "react-router";
import { examTemplateAPI, examSessionAPI, classroomAPI } from "~/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { cn } from "~/lib/utils";
import {
  ArrowLeft,
  RefreshCw,
  Unlock,
  ShieldCheck,
  ChevronsUpDown,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

export default function ExamSessionCreate() {
  const navigate = useNavigate();

  const [examTemplateId, setExamTemplateId] = useState("");
  const [templateComboOpen, setTemplateComboOpen] = useState(false);
  const [classroomComboOpen, setClassroomComboOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [blacklist, setBlacklist] = useState("");
  const [entryMode, setEntryMode] = useState<"open" | "approval">("approval");
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<string[]>(
    [],
  );
  const [manualWhitelist, setManualWhitelist] = useState<string[]>([]);
  const [textareaValue, setTextareaValue] = useState("");

  const generateAccessKey = () => {
    const chars =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let key = "";
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccessKey(key);
  };

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["exam-templates"],
    queryFn: () => examTemplateAPI.getAll(),
  });

  const { data: classroomsData } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => classroomAPI.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => examSessionAPI.create(data),
    onSuccess: (response) => {
      const roomCode = response.data.session.roomCode;
      toast.success(`Exam session created! Room Code: ${roomCode}`, {
        duration: 5000,
      });
      navigate("/lecturer/exam-sessions");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to create session");
    },
  });

  const handleSubmit = () => {
    if (!examTemplateId) {
      toast.error("Please select an exam template");
      return;
    }
    if (!sessionName.trim()) {
      toast.error("Please enter session name");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("Please set start and end time");
      return;
    }
    if (!accessKey.trim()) {
      toast.error("Please enter access key");
      return;
    }

    const data = {
      examTemplateId,
      sessionName,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      accessKey,
      entryMode,
      whitelist: textareaValue
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean),
      blacklist: blacklist
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean),
      classroomIds: selectedClassroomIds,
    };
    createMutation.mutate(data);
  };

  const toggleClassroom = (e: React.MouseEvent, classroomId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const classroom = classrooms.find((c: any) => c._id === classroomId);
    if (!classroom) return;
    setSelectedClassroomIds((prev) => {
      if (prev.includes(classroomId)) {
        setTextareaValue((text) => {
          let updatedText = text;
          classroom.students?.forEach((student: any) => {
            updatedText = updatedText.replace(student + "\n", "");
          });
          return updatedText;
        });
        return prev.filter((id) => id !== classroomId);
      } else {
        setTextareaValue((text) => {
          const existingStudents = new Set(
            text
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          );
          let newStudents = "";
          classroom.students?.forEach((student: any) => {
            if (!existingStudents.has(student.trim()))
              newStudents += student + "\n";
          });
          const normalizedText = text.trim()
            ? text.endsWith("\n")
              ? text
              : text + "\n"
            : "";
          return normalizedText + newStudents;
        });
        return [...prev, classroomId];
      }
    });
  };

  const templates = templatesData?.data?.templates || [];
  const classrooms = classroomsData?.data?.classrooms || [];
  const selectedTemplate = templates.find((t: any) => t._id === examTemplateId);
  const classroomStudentCount = classrooms
    .filter((c: any) => selectedClassroomIds.includes(c._id))
    .reduce((acc: number, c: any) => acc + (c.students?.length || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/lecturer/exam-sessions")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-lg font-semibold text-foreground">
              Create Exam Session
            </h1>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Session"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Template */}
            <div className="bg-card border border-border rounded-md p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Template</h2>

              <div className="space-y-1">
                <Label htmlFor="template" className="text-xs text-muted-foreground">
                  Exam Template <span className="text-destructive">*</span>
                </Label>
                <Popover
                  open={templateComboOpen}
                  onOpenChange={setTemplateComboOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={templateComboOpen}
                      className="w-full justify-between font-normal text-sm text-left h-9"
                    >
                      <span className="truncate">
                        {examTemplateId
                          ? (() => {
                              const t = templates.find(
                                (t: any) => t._id === examTemplateId,
                              );
                              return t
                                ? `${t.templateName} (${t.examType} · ${t.language})`
                                : "Select template...";
                            })()
                          : "Select template..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0"
                    style={{ width: "var(--radix-popover-trigger-width)" }}
                  >
                    <Command>
                      <CommandInput placeholder="Search..." />
                      <CommandList>
                        <CommandEmpty>No templates found.</CommandEmpty>
                        <CommandGroup>
                          {isLoading ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              Loading...
                            </div>
                          ) : (
                            templates.map((template: any) => (
                              <CommandItem
                                key={template._id}
                                value={`${template.templateName} ${template.examType} ${template.language}`}
                                onSelect={() => {
                                  setExamTemplateId(template._id);
                                  setSessionName(template.templateName);
                                  setTemplateComboOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-3.5 w-3.5",
                                    examTemplateId === template._id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {template.templateName}
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  {template.examType} · {template.language}
                                </span>
                              </CommandItem>
                            ))
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedTemplate && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="default">{selectedTemplate.examType}</Badge>
                    <Badge variant="default" className="capitalize">
                      {selectedTemplate.language}
                    </Badge>
                    <Badge variant="default">{selectedTemplate.duration} min</Badge>
                    <Badge variant="default">
                      {selectedTemplate.examCodes?.length || 0} codes
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-card border border-border rounded-md p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                Session Info
              </h2>

              <div className="space-y-1">
                <Label htmlFor="sessionName" className="text-xs text-muted-foreground">
                  Session Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sessionName"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., OOP Midterm K21 Spring 2025"
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="startTime" className="text-xs text-muted-foreground">
                    Start Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartTime(val);
                      if (val && selectedTemplate?.duration) {
                        const end = new Date(
                          new Date(val).getTime() +
                            selectedTemplate.duration * 60000,
                        );
                        const pad = (n: number) => String(n).padStart(2, "0");
                        setEndTime(
                          `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`,
                        );
                      }
                    }}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endTime" className="text-xs text-muted-foreground">
                    End Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="accessKey" className="text-xs text-muted-foreground">
                  Access Key <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateAccessKey}
                    className="h-9 px-3"
                    aria-label="Generate random access key"
                    title="Generate random key"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Input
                    id="accessKey"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    placeholder="e.g., K21OOP2025"
                    className="flex-1 h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Entry Mode */}
            <div className="bg-card border border-border rounded-md p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Entry Mode
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEntryMode("open")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-md border text-left transition-colors cursor-pointer",
                    entryMode === "open"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-foreground hover:border-foreground/20",
                  )}
                >
                  <Unlock className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">Open Room</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode("approval")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-md border text-left transition-colors cursor-pointer",
                    entryMode === "approval"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-foreground hover:border-foreground/20",
                  )}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">Approval</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">
            {/* Whitelist */}
            <div className="bg-card border border-border rounded-md p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                Whitelist{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </h2>

              {classrooms.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    From Classroom
                  </Label>
                  <Popover
                    open={classroomComboOpen}
                    onOpenChange={setClassroomComboOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={classroomComboOpen}
                        className="w-full justify-between font-normal text-sm text-left h-9"
                      >
                        <span className="truncate">
                          {selectedClassroomIds.length > 0
                            ? `${selectedClassroomIds.length} classroom selected`
                            : "Select classrooms..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0"
                      style={{ width: "var(--radix-popover-trigger-width)" }}
                    >
                      <Command>
                        <CommandInput placeholder="Search classroom..." />
                        <CommandList>
                          <CommandEmpty>No classrooms found.</CommandEmpty>
                          <CommandGroup>
                            {classrooms.map((classroom: any) => {
                              const isSelected = selectedClassroomIds.includes(
                                classroom._id,
                              );
                              return (
                                <CommandItem
                                  key={classroom._id}
                                  value={classroom.classroomName}
                                  onSelect={() => {
                                    const fakeEvent = {
                                      stopPropagation: () => {},
                                      preventDefault: () => {},
                                    } as React.MouseEvent;
                                    toggleClassroom(fakeEvent, classroom._id);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-3.5 w-3.5",
                                      isSelected ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <span className="flex-1">
                                    {classroom.classroomName}
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {classroom.students?.length || 0} sv
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Selected classroom tags */}
                  {selectedClassroomIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedClassroomIds.map((id) => {
                        const c = classrooms.find((c: any) => c._id === id);
                        if (!c) return null;
                        return (
                          <Badge key={id} variant="default">
                            {c.classroomName}
                            <button
                              type="button"
                              onClick={(e) => toggleClassroom(e, id)}
                              className="ml-1 text-muted-foreground hover:text-foreground cursor-pointer leading-none"
                              aria-label={`Remove ${c.classroomName}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {classroomStudentCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {classroomStudentCount} students selected
                    </p>
                  )}
                </div>
              )}

              {classrooms.length > 0 && (
                <div className="border-t border-border" />
              )}

              <div className="space-y-1">
                <Label htmlFor="whitelist" className="text-xs text-muted-foreground">
                  Manual (email per line)
                </Label>
                <Textarea
                  id="whitelist"
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                  placeholder={"student1@tdtu.edu.vn\nstudent2@tdtu.edu.vn"}
                  rows={4}
                  className="text-sm font-mono resize-none"
                />
              </div>
            </div>

            {/* Blacklist */}
            <div className="bg-card border border-border rounded-md p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Blacklist{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </h2>
              <Textarea
                id="blacklist"
                value={blacklist}
                onChange={(e) => setBlacklist(e.target.value)}
                placeholder={"blocked@tdtu.edu.vn"}
                rows={3}
                className="text-sm font-mono resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
