import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { examTemplateAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Plus,
  Trash2,
  Edit,
  FileText,
  Clock,
  Code,
  Search,
  Share2,
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
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

type ViewMode = "grid" | "list";

const EXAM_TYPES = ["OOP", "DSA", "General"] as const;
const LANGUAGES = ["java", "python", "cpp", "javascript"] as const;

export default function ExamTemplateList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["exam-templates"],
    queryFn: () => examTemplateAPI.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examTemplateAPI.delete(id),
    onSuccess: () => {
      toast.success("Template deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["exam-templates"] });
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  // Delete confirm state
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

  // Share state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTemplateId, setShareTemplateId] = useState<string | null>(null);
  const [shareTemplateName, setShareTemplateName] = useState("");
  const [shareEmail, setShareEmail] = useState("");

  const shareMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      examTemplateAPI.share(id, email),
    onSuccess: (res) => {
      toast.success(res.data?.message || "Template shared successfully!");
      setShareDialogOpen(false);
      setShareEmail("");
      setShareTemplateId(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || "Failed to share template";
      toast.error(msg);
    },
  });

  const handleOpenShare = (templateId: string, templateName: string) => {
    setShareTemplateId(templateId);
    setShareTemplateName(templateName);
    setShareEmail("");
    setShareDialogOpen(true);
  };

  const handleShare = () => {
    if (!shareTemplateId || !shareEmail.trim()) return;
    shareMutation.mutate({ id: shareTemplateId, email: shareEmail.trim() });
  };

  const templates = data?.data?.templates || [];
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t: any) => {
      if (q && !t.templateName.toLowerCase().includes(q)) return false;
      if (typeFilter && t.examType !== typeFilter) return false;
      if (languageFilter && t.language !== languageFilter) return false;
      if (statusFilter === "published" && !t.isPublished) return false;
      if (statusFilter === "draft" && t.isPublished) return false;
      return true;
    });
  }, [templates, query, typeFilter, languageFilter, statusFilter]);

  const hasActiveFilter =
    !!query || !!typeFilter || !!languageFilter || statusFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setTypeFilter(null);
    setLanguageFilter(null);
    setStatusFilter("all");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading templates...</p>
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
              Exam Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {templates.length} template{templates.length === 1 ? "" : "s"}
              {hasActiveFilter && ` · ${filtered.length} shown`}
            </p>
          </div>
          <Button onClick={() => navigate("/lecturer/exam-templates/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
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
                placeholder="Search templates by name…"
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
            <FilterPills
              label="Type"
              options={[...EXAM_TYPES]}
              value={typeFilter}
              onChange={setTypeFilter}
            />
            <FilterPills
              label="Language"
              options={[...LANGUAGES]}
              value={languageFilter}
              onChange={setLanguageFilter}
            />
            <FilterPills
              label="Status"
              options={["published", "draft"]}
              value={statusFilter === "all" ? null : statusFilter}
              onChange={(v) => setStatusFilter((v ?? "all") as typeof statusFilter)}
              format={(s) => (s === "published" ? "Published" : "Draft")}
            />
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
            onCreate={() => navigate("/lecturer/exam-templates/create")}
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((template: any) => (
              <TemplateCard
                key={template._id}
                template={template}
                onEdit={() =>
                  navigate(`/lecturer/exam-templates/${template._id}/edit`)
                }
                onShare={() =>
                  handleOpenShare(template._id, template.templateName)
                }
                onDelete={() =>
                  handleOpenDelete(template._id, template.templateName)
                }
              />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
            {filtered.map((template: any) => (
              <TemplateRow
                key={template._id}
                template={template}
                onEdit={() =>
                  navigate(`/lecturer/exam-templates/${template._id}/edit`)
                }
                onShare={() =>
                  handleOpenShare(template._id, template.templateName)
                }
                onDelete={() =>
                  handleOpenDelete(template._id, template.templateName)
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
              Delete Template
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>"{deleteTargetName}"</strong>? This action cannot be
              undone.
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

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Template</DialogTitle>
            <DialogDescription>
              Share "<strong>{shareTemplateName}</strong>" by entering the
              recipient's email address. A copy will be created in their
              account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="share-email">Recipient Email</Label>
              <Input
                id="share-email"
                type="email"
                placeholder="Enter email address..."
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && shareEmail.trim()) {
                    handleShare();
                  }
                }}
                disabled={shareMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShareDialogOpen(false)}
              disabled={shareMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={!shareEmail.trim() || shareMutation.isPending}
            >
              {shareMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
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
/*                                Filter pills                                */
/* -------------------------------------------------------------------------- */

function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
  format?: (s: T) => string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">
        {label}
      </span>
      <div className="inline-flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "h-6 px-2 rounded text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === null
              ? "bg-card text-foreground shadow-sm"
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
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {format ? format(opt) : opt}
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

function TemplateCard({
  template,
  onEdit,
  onShare,
  onDelete,
}: {
  template: any;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-card rounded-lg border border-border hover:border-foreground/20 transition-colors">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 truncate">
              {template.templateName}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="info">{template.examType}</Badge>
              {template.isPublished ? (
                <Badge variant="success">Published</Badge>
              ) : (
                <Badge variant="default">Draft</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>
              {template.examCodeCount ||
                template.examCodes?.length ||
                0}{" "}
              exam codes
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code className="w-4 h-4" />
            <span className="capitalize">{template.language}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{template.duration} minutes</span>
          </div>
        </div>

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
            onClick={onShare}
            title="Share template"
            aria-label="Share template"
          >
            <Share2 className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            title="Delete template"
            aria-label="Delete template"
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

function TemplateRow({
  template,
  onEdit,
  onShare,
  onDelete,
}: {
  template: any;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-sm font-semibold shrink-0">
        {initials(template.templateName)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {template.templateName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {template.examCodeCount || template.examCodes?.length || 0} codes ·{" "}
          <span className="capitalize">{template.language}</span> ·{" "}
          {template.duration} min
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <Badge variant="info">{template.examType}</Badge>
        {template.isPublished ? (
          <Badge variant="success">Published</Badge>
        ) : (
          <Badge variant="default">Draft</Badge>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-8"
        >
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onShare}
          className="h-8 w-8 p-0 text-muted-foreground"
          title="Share"
          aria-label="Share template"
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Delete"
          aria-label="Delete template"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function initials(name: string): string {
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
          No matching templates
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {query
            ? `No templates match "${query}".`
            : "No templates match the current filters."}
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
      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-lg font-medium text-foreground mb-1">
        No templates yet
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Create your first exam template to get started.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4 mr-2" />
        Create Template
      </Button>
    </div>
  );
}