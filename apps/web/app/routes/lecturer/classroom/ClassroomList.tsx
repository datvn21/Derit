/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4
 * genre: modern-minimal · macrostructure: App Dashboard · design-system: design.md · designed-as-app
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { classroomAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Edit,
  Users,
  Calendar,
  Search,
  MoreHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { getClassroomAcademicYear } from "~/lib/academic-year";
import { ViewToggle, type ViewMode } from "~/components/ui/view-toggle";
import { PageLoading } from "~/components/ui/page-loading";
import { EmptyState } from "~/components/ui/empty-state";
import { ConfirmDeleteDialog } from "~/components/ui/confirm-delete-dialog";

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
  const [academicYearFilter, setAcademicYearFilter] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const academicYears = useMemo(() => {
    return Array.from(
      new Set<string>(
        classrooms.map((classroom: any) => getClassroomAcademicYear(classroom)),
      ),
    ).sort((a, b) => Number(b) - Number(a));
  }, [classrooms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classrooms.filter((c: any) => {
      if (q && !c.classroomName.toLowerCase().includes(q)) return false;
      if (
        academicYearFilter &&
        getClassroomAcademicYear(c) !== academicYearFilter
      ) {
        return false;
      }
      return true;
    });
  }, [classrooms, query, academicYearFilter]);

  const hasActiveFilter = !!query || !!academicYearFilter;

  const clearFilters = () => {
    setQuery("");
    setAcademicYearFilter(null);
  };

  if (isLoading) {
    return <PageLoading label="Loading classrooms…" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Page header - title + create action only */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Classrooms
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {classrooms.length} classroom{classrooms.length === 1 ? "" : "s"}
              {hasActiveFilter && ` · ${filtered.length} shown`}
            </p>
          </div>
          <Button
            onClick={() => navigate("/lecturer/classrooms/create")}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Classroom
          </Button>
        </div>

        <ClassroomToolbar
          query={query}
          onQueryChange={setQuery}
          academicYears={academicYears}
          academicYearFilter={academicYearFilter}
          onAcademicYearFilterChange={setAcademicYearFilter}
        />

        <div className="flex justify-start">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={hasActiveFilter ? Search : Users}
            title={
              hasActiveFilter ? "No matching classrooms" : "No classrooms yet"
            }
            description={
              hasActiveFilter
                ? query
                  ? `No classrooms match "${query}".`
                  : "No classrooms match the current filters."
                : "Create your first classroom to group students for exams."
            }
            action={
              hasActiveFilter ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => navigate("/lecturer/classrooms/create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Classroom
                </Button>
              )
            }
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          <Card className="overflow-hidden shadow-none">
            <Table>
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead>Classroom</TableHead>
                  <TableHead className="w-32">Year</TableHead>
                  <TableHead className="w-32">Students</TableHead>
                  <TableHead className="w-36">Created</TableHead>
                  <TableHead className="w-48">Preview</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((classroom: any) => (
                  <ClassroomListRow
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
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Classroom"
        description={
          <>
            Are you sure you want to delete{" "}
            <strong>"{deleteTargetName}"</strong>? This action cannot be undone.
            Existing sessions linked to this classroom will not be affected.
          </>
        }
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Classroom toolbar                             */
/* -------------------------------------------------------------------------- */

function ClassroomToolbar({
  query,
  onQueryChange,
  academicYears,
  academicYearFilter,
  onAcademicYearFilterChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  academicYears: string[];
  academicYearFilter: string | null;
  onAcademicYearFilterChange: (value: string | null) => void;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search classrooms by name…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={academicYearFilter ?? "all"}
              onValueChange={(val) =>
                onAcademicYearFilterChange(val === "all" ? null : val)
              }
            >
              <SelectTrigger
                className="w-[140px] h-9"
                aria-label="Filter by academic year"
              >
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {academicYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const academicYear = getClassroomAcademicYear(classroom);
  return (
    <Card className="group shadow-none transition-colors hover:border-foreground/20">
      <CardHeader className="flex-row items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0 space-y-2">
          <h3 className="truncate font-semibold leading-tight text-foreground">
            {classroom.classroomName}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">
              {studentCount} student{studentCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="info">{academicYear}</Badge>
          </div>
        </div>
        <ClassroomActions onDelete={onDelete} />
      </CardHeader>

      <CardContent className="space-y-3 p-5 pt-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            Created {new Date(classroom.createdAt).toLocaleDateString("vi-VN")}
          </span>
        </div>

        {studentCount > 0 && (
          <div className="rounded-md border border-border bg-muted/60 px-3 py-2">
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
      </CardContent>

      <CardFooter className="border-t border-border p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="w-full justify-center"
        >
          <Edit className="w-3.5 h-3.5 mr-1" />
          Edit
        </Button>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                List table                                  */
/* -------------------------------------------------------------------------- */

function ClassroomListRow({
  classroom,
  onEdit,
  onDelete,
}: {
  classroom: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const studentCount = classroom.students?.length || 0;
  const academicYear = getClassroomAcademicYear(classroom);
  const createdAt = new Date(classroom.createdAt).toLocaleDateString("vi-VN");
  const preview = classroom.students?.slice(0, 3).join(", ") || "-";

  return (
    <TableRow>
      <TableCell className="min-w-[260px]">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {classroom.classroomName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground md:hidden">
            <span>
              {studentCount} student{studentCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden="true">·</span>
            <span>AY {academicYear}</span>
            <span aria-hidden="true">·</span>
            <span>Created {createdAt}</span>
          </div>
          <p className="mt-2 truncate text-xs font-mono text-muted-foreground md:hidden">
            {preview}
            {studentCount > 3 && ` +${studentCount - 3} more`}
          </p>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="info">{academicYear}</Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="default">
          {studentCount} student{studentCount === 1 ? "" : "s"}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {createdAt}
      </TableCell>
      <TableCell className="hidden max-w-48 truncate font-mono text-xs text-muted-foreground md:table-cell">
        {preview}
        {studentCount > 3 && ` +${studentCount - 3} more`}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <ClassroomActions onDelete={onDelete} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function ClassroomActions({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label="Classroom actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
