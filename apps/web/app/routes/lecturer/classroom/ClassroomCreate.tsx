import { useNavigate } from "react-router";
import { classroomAPI } from "~/lib/api";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClassroomForm, type ClassroomFormData } from "./ClassroomForm";

export default function ClassroomCreate() {
  const navigate = useNavigate();

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

  const handleSubmit = (data: ClassroomFormData) => {
    createMutation.mutate(data);
  };

  return (
    <ClassroomForm
      title="Create Classroom"
      submitLabel="Save"
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
    />
  );
}
