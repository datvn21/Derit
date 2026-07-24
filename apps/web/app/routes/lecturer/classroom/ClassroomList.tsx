import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { classroomAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Plus, Trash2, Edit, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export default function ClassroomList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => classroomAPI.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classroomAPI.delete(id),
    onSuccess: () => {
      toast.success("Classroom deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
    },
    onError: () => {
      toast.error("Failed to delete classroom");
    },
  });

  const classrooms = data?.data?.classrooms || [];
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      classrooms.filter((c: any) =>
        c.classroomName.toLowerCase().includes(query.toLowerCase()),
      ),
    [classrooms, query],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground mt-4">Loading classrooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Classrooms</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search classrooms..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 w-52"
                />
              </div>
              <Button onClick={() => navigate("/lecturer/classrooms/create")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Classroom
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">
              {query ? "No classrooms found" : "No classrooms yet"}
            </h3>
            {!query && (
              <>
                <p className="text-muted-foreground mb-6">
                  Create your first classroom to group students for exams
                </p>
                <Button onClick={() => navigate("/lecturer/classrooms/create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Classroom
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((classroom: any) => (
              <div
                key={classroom._id}
                className="bg-card rounded-lg border border-border hover:border-foreground/20 transition-colors"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 flex justify-between items-center">
                      <h3 className="font-semibold text-foreground mb-1">
                        {classroom.classroomName}
                      </h3>
                      <div className="text-xs text-muted-foreground">
                        Created{" "}
                        {new Date(classroom.createdAt).toLocaleDateString(
                          "vi-VN",
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span>Students</span>

                      <span className="font-bold text-md text-foreground">
                        {classroom.students?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Student preview */}
                  {classroom.students?.length > 0 && (
                    <div className="mb-4 p-3 bg-muted rounded-lg border border-border">
                      <p className="text-xs text-foreground font-mono leading-relaxed">
                        {classroom.students.slice(0, 3).join(", ")}
                        {classroom.students.length > 3 && (
                          <span className="text-muted-foreground">
                            {" "}
                            +{classroom.students.length - 3} more
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/lecturer/classrooms/${classroom._id}/edit`)
                      }
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${classroom.classroomName}"? This won't affect existing sessions.`,
                          )
                        ) {
                          deleteMutation.mutate(classroom._id);
                        }
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
