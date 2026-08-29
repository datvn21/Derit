import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { classroomAPI } from "~/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLoading } from "~/components/ui/page-loading";
import { toast } from "sonner";
import { recordRecentItem } from "~/lib/recents";
import { getClassroomAcademicYear } from "~/lib/academic-year";
import { ClassroomForm, type ClassroomFormData } from "./ClassroomForm";

export default function ClassroomEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["classroom", id],
    queryFn: () => classroomAPI.getById(id!),
    enabled: !!id,
  });

  const classroom = data?.data?.classroom;

  useEffect(() => {
    if (classroom) {
      recordRecentItem({
        type: "Classroom",
        name: classroom.classroomName,
        href: `/lecturer/classrooms/${id}/edit`,
      });
    }
  }, [classroom, id]);

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

  if (isLoading || !classroom) {
    return <PageLoading label="Loading classroom…" />;
  }

  return (
    <ClassroomForm
      key={classroom._id}
      title="Edit Classroom"
      submitLabel="Save Changes"
      initialValues={{
        classroomName: classroom.classroomName,
        academicYear: getClassroomAcademicYear(classroom),
        students: classroom.students || [],
      }}
      onSubmit={(formData: ClassroomFormData) => {
        updateMutation.mutate(formData);
      }}
      isSubmitting={updateMutation.isPending}
    />
  );
}
