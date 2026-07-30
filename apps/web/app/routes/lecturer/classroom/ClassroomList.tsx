import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { classroomAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Plus,
  Trash2,
  Edit,
  Users,
  Calendar,
  Search,
  Loader2,
  LayoutGrid,
  List as ListIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type ViewMode = "grid" | "list";
type SizeFilter = "all" | "small" | "medium" | "large";

const SIZE_THRESHOLDS = {
  small: { max: 20, label: "Small (≤20)" },
  medium: { min: 21, max: 50, label: "Medium (21-50)" },
  large: { min: 51, label: "Large (>50)" },
} as const;

function matchesSize(count: number, size: SizeFilter): boolean {
  if (size === "all") return true;
  if (size === "small") return count <= SIZE_THRESHOLDS.small.max;
  if (size === "medium")
    return count >= SIZE_THRESHOLDS.medium.min && count <= SIZE_THRESHOLDS.medium.max;
  return count >= SIZE_THRESHOLDS.large.min;
}

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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState("");

  const handleOpenDelete = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    deleteMutation.mutate(deleteTargetId);
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  const classrooms = data?.data?.classrooms || [];
  const [query, setQuery] = useState("");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classrooms.filter((c: any) => {
      const studentCount = c.students?.length || 0;
      if (q && !c.classroomName.toLowerCase().includes(q)) return false;
      if (sizeFilter && !matchesSize(studentCount, sizeFilter)) return false;
      return true;
    });
  }, [classrooms, query, sizeFilter]);

  const hasActiveFilter = !!query || !!sizeFilter;

  const clearFilters = () => {
    setQuery("");
    setSizeFilter(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading classrooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page header — title + create action only */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Classrooms
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {classrooms.length} classroom{classrooms.length === 1 ? "" : "s"}
              {hasActiveFilter && ` · ${filtered.length} shown`}
            </p>
          </div>
          <Button onClick={() => navigate("/lecturer/classrooms/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Classroom
          </Button>
        </div>
      </div>

      {/* Filter + search bar (below header) */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search classrooms by name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SizeFilterPills value={sizeFilter} onChange={setSizeFilter} />
            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto text-muted-foreground"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {filtered.length === 0 ? (
          <EmptyState
            query={query}
            hasFilter={hasActiveFilter}
            onClear={clearFilters}
            onCreate={() => navigate("/lecturer/classrooms/create")}
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((classroom: any) => (
              <ClassroomCard
                key={classroom._id}
                classroom={classroom}
                onEdit={() =>
                  navigate(`/lecturer/classrooms/${classroom._id}/edit`)
                }
                onDelete={() =>
                  handleOpenDelete(classroom._id, classroom.classroomName)
                }
              />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
            {filtered.map((classroom: any) => (
              <ClassroomRow
                key={classroom._id}
                classroom={classroom}
                onEdit={() =>
                  navigate(`/lecturer/classrooms/${classroom._id}/edit`)
                }
                onDelete={() =>
                  handleOpenDelete(classroom._id, classroom.classroomName)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Classroom
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>"{deleteTargetName}"</strong>? This action cannot be
              undone. Existing sessions linked to this classroom will not be
              affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Filter pills                                  */
/* -------------------------------------------------------------------------- */

function SizeFilterPills({
  value,
  onChange,
}: {
  value: SizeFilter | null;
  onChange: (v: SizeFilter | null) => void;
}) {
  const options: SizeFilter[] = ["small", "medium", "large"];
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium tracking-wider mr-1">
        Size
      </span>
      <div className="inline-flex items-center gap-1 bg-muted rounded-md p-0.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "h-6 px-2 rounded text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === null
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? null : opt)}
            className={cn(
              "h-6 px-2 rounded text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === opt
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {SIZE_THRESHOLDS[opt].label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                View toggle                                 */
/* -------------------------------------------------------------------------- */

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex items-center bg-muted/50 rounded-md p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "grid"}
        onClick={() => onChange("grid")}
        title="Grid view"
        aria-label="Grid view"
        className={cn(
          "h-7 w-7 inline-flex items-center justify-center rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value === "grid"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "list"}
        onClick={() => onChange("list")}
        title="List view"
        aria-label="List view"
        className={cn(
          "h-7 w-7 inline-flex items-center justify-center rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value === "list"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ListIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Card view                                   */
/* -------------------------------------------------------------------------- */

function ClassroomCard({
  classroom,
  onEdit,
  onDelete,
}: {
  classroom: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const studentCount = classroom.students?.length || 0;
  return (
    <div className="bg-card rounded-lg border border-border hover:border-foreground/20 transition-colors">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 truncate">
              {classroom.classroomName}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="info">{studentCount} students</Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>
              {studentCount} student{studentCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              Created{" "}
              {new Date(classroom.createdAt).toLocaleDateString("vi-VN")}
            </span>
          </div>
        </div>

        {studentCount > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-lg border border-border">
            <p className="text-xs text-foreground font-mono leading-relaxed truncate">
              {classroom.students.slice(0, 3).join(", ")}
              {studentCount > 3 && (
                <span className="text-muted-foreground">
                  {" "}
                  +{studentCount - 3} more
                </span>
              )}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1"
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            title="Delete classroom"
            aria-label="Delete classroom"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                List row                                    */
/* -------------------------------------------------------------------------- */

function ClassroomRow({
  classroom,
  onEdit,
  onDelete,
}: {
  classroom: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const studentCount = classroom.students?.length || 0;
  const initials = getInitials(classroom.classroomName);
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-sm font-semibold shrink-0">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {classroom.classroomName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {studentCount} student{studentCount === 1 ? "" : "s"} · Created{" "}
          {new Date(classroom.createdAt).toLocaleDateString("vi-VN")}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <Badge variant="info">{studentCount} students</Badge>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Delete"
          aria-label="Delete classroom"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/*                                Empty state                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({
  query,
  hasFilter,
  onClear,
  onCreate,
}: {
  query: string;
  hasFilter: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  if (hasFilter) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-medium text-foreground mb-1">
          No matching classrooms
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {query
            ? `No classrooms match "${query}".`
            : "No classrooms match the current filters."}
        </p>
        <Button variant="outline" onClick={onClear}>
          <X className="w-3.5 h-3.5 mr-1" />
          Clear filters
        </Button>
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-lg p-12 text-center">
      <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-lg font-medium text-foreground mb-1">
        No classrooms yet
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Create your first classroom to group students for exams.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4 mr-2" />
        Create Classroom
      </Button>
    </div>
  );
}