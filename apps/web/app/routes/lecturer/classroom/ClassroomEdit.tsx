import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { classroomAPI } from "~/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";

export default function ClassroomEdit() {
    const navigate = useNavigate();
    const { id } = useParams();
    const queryClient = useQueryClient();

    const [classroomName, setClassroomName] = useState("");
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
            setClassroomName(classroom.classroomName);
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

        updateMutation.mutate({ classroomName: classroomName.trim(), students });
    };

    const studentCount = studentsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0).length;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div>
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                onClick={() => navigate("/lecturer/classrooms")}
                                className="text-gray-600 cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Edit Classroom
                            </h1>
                        </div>
                        <Button
                            onClick={handleSubmit}
                            disabled={updateMutation.isPending}
                            className="bg-primary hover:bg-primary/80 text-white cursor-pointer"
                        >
                            {updateMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="bg-white rounded-md border border-gray-200 p-6 space-y-6">
                    {/* Classroom Name */}
                    <div>
                        <Label htmlFor="classroomName" className="flex items-center gap-1 mb-2">
                            Classroom Name <span className="text-red-500">*</span>
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
                            <Label htmlFor="students">Student IDs</Label>
                            {studentCount > 0 && (
                                <span className="text-xs font-medium text-primary bg-blue-50 px-2 py-0.5 rounded-full">
                                    {studentCount} student{studentCount !== 1 ? "s" : ""}
                                </span>
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
                        <p className="text-xs text-gray-500 mt-2">
                            Enter one student ID per line (e.g.{" "}
                            <code className="bg-gray-100 px-1 py-0.5 rounded">521H0001</code>
                            ). Each ID will be formatted as{" "}
                            <code className="bg-gray-100 px-1 py-0.5 rounded">
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
