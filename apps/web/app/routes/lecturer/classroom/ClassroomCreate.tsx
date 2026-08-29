import { useState } from "react";
import { useNavigate } from "react-router";
import { classroomAPI } from "~/lib/api";
import { useMutation } from "@tanstack/react-query";
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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  getAcademicYearOptions,
  getCurrentAcademicYear,
} from "~/lib/academic-year";

export default function ClassroomCreate() {
  const navigate = useNavigate();

  const [classroomName, setClassroomName] = useState("");
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear);
  const [studentsRaw, setStudentsRaw] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: any) => classroomAPI.create(data),
    onSuccess: () => {
      toast.success("Classroom created successfully!");
      navigate("/lecturer/classrooms");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to create classroom");
    },
  });

  const handleSubmit = () => {
    if (!classroomName.trim()) {
      toast.error("Please enter a classroom name");
      return;
    }

    const students = studentsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    createMutation.mutate({
      classroomName: classroomName.trim(),
      academicYear: academicYear.trim() || getCurrentAcademicYear(),
      students,
    });
  };

  // parse student count for live preview
  const studentCount = studentsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
  const academicYearOptions = getAcademicYearOptions(academicYear);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-y border-border/80 bg-card">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-5">
              <Button
                variant="outline"
                onClick={() => navigate("/lecturer/classrooms")}
                className="h-9 rounded-lg bg-card px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                Create Classroom
              </h1>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="h-10 shrink-0 rounded-lg px-5"
            >
              {createMutation.isPending ? "Creating..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="space-y-6 rounded-md border border-border bg-card p-5 sm:p-6">
          {/* Classroom Name */}
          <div>
            <Label
              htmlFor="classroomName"
              className="flex items-center gap-1 mb-2"
            >
              Classroom Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="classroomName"
              value={classroomName}
              onChange={(e) => setClassroomName(e.target.value)}
              placeholder="e.g., K21 OOP - Group A"
              className="mt-1"
            />
          </div>

          {/* Academic Year */}
          <div>
            <Label htmlFor="academicYear" className="mb-2 block">
              Academic Year
            </Label>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger id="academicYear" className="mt-1 w-full">
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
            <p className="mt-2 text-xs text-muted-foreground">
              Defaults to {getCurrentAcademicYear()} for new classrooms.
            </p>
          </div>

          {/* Student IDs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="students" className="flex items-center gap-1">
                Student IDs
              </Label>
              {studentCount > 0 && (
                <Badge variant="info">
                  {studentCount} student{studentCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <Textarea
              id="students"
              value={studentsRaw}
              onChange={(e) => setStudentsRaw(e.target.value)}
              placeholder={"521H0001\n521H0002\n521H0003"}
              rows={10}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter one student ID per line (e.g.{" "}
              <code className="bg-muted px-1 py-0.5 rounded">521H0001</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
