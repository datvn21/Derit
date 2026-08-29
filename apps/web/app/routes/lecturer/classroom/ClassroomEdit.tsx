import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { classroomAPI } from "~/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { recordRecentItem } from "~/lib/recents";
import {
  getAcademicYearOptions,
  getClassroomAcademicYear,
  getCurrentAcademicYear,
} from "~/lib/academic-year";

export default function ClassroomEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [classroomName, setClassroomName] = useState("");
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear);
  const [studentsRaw, setStudentsRaw] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["classroom", id],
    queryFn: () => classroomAPI.getById(id!),
    enabled: !!id,
  });

  // Pre-fill form when data loads
  useEffect(() => {
    if (data?.data?.classroom) {
      const classroom = data.data.classroom;
      recordRecentItem({
        type: "Classroom",
        name: classroom.classroomName,
        href: `/lecturer/classrooms/${id}/edit`,
      });
      setClassroomName(classroom.classroomName);
      setAcademicYear(getClassroomAcademicYear(classroom));
      setStudentsRaw((classroom.students || []).join("\n"));
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updateData: any) => classroomAPI.update(id!, updateData),
    onSuccess: () => {
      toast.success("Classroom updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      navigate("/lecturer/classrooms");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update classroom");
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

    updateMutation.mutate({
      classroomName: classroomName.trim(),
      academicYear: academicYear.trim() || getCurrentAcademicYear(),
      students,
    });
  };

  const studentCount = studentsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
  const academicYearOptions = getAcademicYearOptions(academicYear);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/80 bg-card/95">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/lecturer/classrooms")}
                className="h-8 rounded-md border border-border bg-muted/70 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Edit Classroom
              </h1>
            </div>
            <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
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
              Controls which academic-year filter this classroom appears under.
            </p>
          </div>

          {/* Student IDs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="students">Student IDs</Label>
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
