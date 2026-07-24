import { useState } from "react";
import { useNavigate } from "react-router";
import { classroomAPI } from "~/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function ClassroomCreate() {
  const navigate = useNavigate();

  const [classroomName, setClassroomName] = useState("");
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

    createMutation.mutate({ classroomName: classroomName.trim(), students });
  };

  // parse student count for live preview
  const studentCount = studentsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div>
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/lecturer/classrooms")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold text-foreground">
                Create Classroom
              </h1>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Classroom"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-card rounded-md border border-border p-6 space-y-6">
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
              Each ID will be formatted as{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                521H0001@student.tdtu.edu.vn
              </code>{" "}
              when added to an exam whitelist.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
