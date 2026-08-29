import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ArrowLeft, User, Users, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { classroomAPI } from "~/lib/api";
import {
  getAcademicYearOptions,
  getCurrentAcademicYear,
} from "~/lib/academic-year";

export interface ClassroomFormData {
  classroomName: string;
  academicYear: string;
  students: string[];
}

export interface ClassroomFormProps {
  title: string;
  submitLabel?: string;
  initialValues?: {
    classroomName?: string;
    academicYear?: string;
    students?: string[];
  };
  onSubmit: (data: ClassroomFormData) => void;
  isSubmitting?: boolean;
  backHref?: string;
}

interface StudentInfo {
  studentId: string;
  name: string;
  email: string;
  avatar?: string;
}

export function ClassroomForm({
  title,
  submitLabel = "Save",
  initialValues,
  onSubmit,
  isSubmitting = false,
  backHref = "/lecturer/classrooms",
}: ClassroomFormProps) {
  const navigate = useNavigate();

  const [classroomName, setClassroomName] = useState(
    initialValues?.classroomName ?? "",
  );
  const [academicYear, setAcademicYear] = useState(
    initialValues?.academicYear || getCurrentAcademicYear(),
  );
  const [studentsRaw, setStudentsRaw] = useState(
    (initialValues?.students ?? []).join("\n"),
  );
  const [previewFilter, setPreviewFilter] = useState("");

  // Parse student IDs from textarea
  const studentIds = useMemo(() => {
    const lines = studentsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // Keep unique IDs in order
    return Array.from(new Set(lines));
  }, [studentsRaw]);

  // Debounced student IDs for API lookup
  const [debouncedIds, setDebouncedIds] = useState<string[]>(studentIds);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedIds(studentIds);
    }, 400);
    return () => clearTimeout(timer);
  }, [studentIds]);

  // Lookup student details from server
  const { data: lookupData, isFetching } = useQuery({
    queryKey: ["classroom-lookup-students", debouncedIds],
    queryFn: () => classroomAPI.lookupStudents(debouncedIds),
    enabled: debouncedIds.length > 0,
    staleTime: 30_000,
  });

  // Map of student lookup keys (lowercase) -> StudentInfo
  const studentMap = useMemo(() => {
    const map = new Map<string, StudentInfo>();
    const students: StudentInfo[] = lookupData?.data?.students || [];
    for (const s of students) {
      if (s.studentId) {
        map.set(s.studentId.trim().toLowerCase(), s);
      }
      if (s.email) {
        const cleanEmail = s.email.trim().toLowerCase();
        map.set(cleanEmail, s);
        const prefix = cleanEmail.split("@")[0].trim();
        if (prefix) {
          map.set(prefix, s);
        }
      }
    }
    return map;
  }, [lookupData]);

  const getStudent = (id: string): StudentInfo | undefined => {
    const raw = id.trim().toLowerCase();
    const prefix = raw.includes("@") ? raw.split("@")[0] : raw;
    return studentMap.get(raw) || studentMap.get(prefix);
  };

  const registeredCount = useMemo(() => {
    return studentIds.filter((id) => !!getStudent(id)).length;
  }, [studentIds, studentMap]);

  // Filtered student IDs for preview search
  const filteredStudentIds = useMemo(() => {
    if (!previewFilter.trim()) return studentIds;
    const q = previewFilter.toLowerCase().trim();
    return studentIds.filter((id) => {
      if (id.toLowerCase().includes(q)) return true;
      const info = getStudent(id);
      if (info?.name.toLowerCase().includes(q)) return true;
      if (info?.email.toLowerCase().includes(q)) return true;
      if (info?.studentId && info.studentId.toLowerCase().includes(q))
        return true;
      return false;
    });
  }, [studentIds, previewFilter, studentMap]);

  const handleSubmit = () => {
    if (!classroomName.trim()) {
      toast.error("Please enter a classroom name");
      return;
    }

    const students = studentsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    onSubmit({
      classroomName: classroomName.trim(),
      academicYear: academicYear.trim() || getCurrentAcademicYear(),
      students,
    });
  };

  const academicYearOptions = getAcademicYearOptions(academicYear);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-xs">
        <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-center px-4 sm:px-6">
          <div className="absolute left-4 flex min-w-0 justify-start sm:left-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(backHref)}
              className="h-8 rounded-md border border-border bg-muted/70 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Button>
          </div>

          <h1 className="min-w-0 max-w-[46vw] truncate text-center text-base font-semibold tracking-tight text-foreground sm:max-w-[56vw]">
            {title}
          </h1>

          <div className="absolute right-4 flex min-w-0 justify-end sm:right-6">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-8 rounded-md px-3.5 text-xs font-medium"
            >
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Details & Student IDs Input */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
              {/* Classroom Name */}
              <div>
                <Label
                  htmlFor="classroomName"
                  className="flex items-center gap-1 mb-2 text-xs font-medium text-foreground"
                >
                  Classroom Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="classroomName"
                  value={classroomName}
                  onChange={(e) => setClassroomName(e.target.value)}
                  placeholder="e.g., K21 OOP - Group A"
                />
              </div>

              {/* Academic Year */}
              <div>
                <Label
                  htmlFor="academicYear"
                  className="mb-2 block text-xs font-medium text-foreground"
                >
                  Academic Year
                </Label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger id="academicYear" className="w-full">
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Defaults to {getCurrentAcademicYear()} for new classrooms.
                </p>
              </div>

              {/* Student IDs Textarea */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label
                    htmlFor="students"
                    className="flex items-center gap-1 text-xs font-medium text-foreground"
                  >
                    Student IDs
                  </Label>
                  {studentIds.length > 0 && (
                    <Badge variant="default" className="text-xs">
                      {studentIds.length} student
                      {studentIds.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <Textarea
                  id="students"
                  value={studentsRaw}
                  onChange={(e) => setStudentsRaw(e.target.value)}
                  placeholder={"521H0001\n521H0002\n521H0003"}
                  rows={9}
                  className="font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter one student ID per line (e.g.{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                    521H0001
                  </code>
                  ).
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Live Student Roster Preview */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="rounded-xl border border-border bg-card flex flex-col flex-1 overflow-hidden min-h-[460px]">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Student Roster Preview
                  </h3>
                </div>
                {isFetching && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 animate-pulse font-medium">
                    Looking up...
                  </span>
                )}
              </div>

              {/* Search Filter (when there are more than 4 students) */}
              {studentIds.length > 4 && (
                <div className="px-4 py-2.5 border-b border-border bg-background">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={previewFilter}
                      onChange={(e) => setPreviewFilter(e.target.value)}
                      placeholder="Filter student list..."
                      className="h-8 pl-8 text-xs bg-muted/40 border-border"
                    />
                  </div>
                </div>
              )}

              {/* Roster List */}
              <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto max-h-[480px]">
                {studentIds.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 stroke-1 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      No student IDs entered
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Enter student IDs in the box on the left to see their
                      profile preview here.
                    </p>
                  </div>
                ) : filteredStudentIds.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    No students match &quot;{previewFilter}&quot;
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredStudentIds.map((id, idx) => {
                      const student = getStudent(id);
                      return (
                        <div
                          key={`${id}-${idx}`}
                          className="flex items-center justify-between py-2.5 px-2 hover:bg-muted/40 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {student?.avatar ? (
                              <img
                                src={student.avatar}
                                alt={student.name}
                                className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                              />
                            ) : student ? (
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                                <User className="w-4 h-4" />
                              </div>
                            )}

                            <div className="min-w-0">
                              {student ? (
                                <>
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {student.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {id}
                                    {student.email ? ` · ${student.email}` : ""}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs font-medium text-foreground">
                                    {id}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Not registered in system
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 ml-3">
                            {student ? (
                              <Badge
                                variant="success"
                                className="text-[10px] py-0 h-5 font-normal flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Registered
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 h-5 font-normal text-muted-foreground border-border"
                              >
                                Unregistered
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Summary */}
              {studentIds.length > 0 && (
                <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {registeredCount} / {studentIds.length} registered
                  </span>
                  <span>
                    {studentIds.length - registeredCount} not registered
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
