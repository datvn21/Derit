/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4
 * genre: modern-minimal · macrostructure: App Dashboard · design-system: design.md · designed-as-app
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { examTemplateAPI } from "~/lib/api";
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
  FileText,
  Search,
  Share2,
  Loader2,
  MoreHorizontal,
  Clock,
  Globe,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { FileIcon } from "~/components/ui/file-icon";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ViewToggle, type ViewMode } from "~/components/ui/view-toggle";
import { cn } from "~/lib/utils";
import { EmptyState } from "~/components/ui/empty-state";
import { ConfirmDeleteDialog } from "~/components/ui/confirm-delete-dialog";

const EXAM_TYPES = ["OOP", "DSA", "General"] as const;
const LANGUAGES = ["java", "python", "cpp"] as const;

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

  const togglePublishMutation = useMutation({
    mutationFn: (templateId: string) =>
      examTemplateAPI.togglePublish(templateId),
    onSuccess: (res) => {
      const isPub = res.data?.template?.isPublished;
      toast.success(
        isPub ? "Template published successfully" : "Template moved to draft",
      );
      queryClient.invalidateQueries({ queryKey: ["exam-templates"] });
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error || "Failed to update template status";
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
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");
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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Page header — title + create action only */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Exam Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {templates.length} template{templates.length === 1 ? "" : "s"}
              {hasActiveFilter && ` · ${filtered.length} shown`}
            </p>
          </div>
          <Button
            onClick={() => navigate("/lecturer/exam-templates/create")}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        <TemplateToolbar
          query={query}
          onQueryChange={setQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          languageFilter={languageFilter}
          onLanguageFilterChange={setLanguageFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <div className="flex justify-start">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={hasActiveFilter ? Search : FileText}
            title={
              hasActiveFilter ? "No matching templates" : "No templates yet"
            }
            description={
              hasActiveFilter
                ? query
                  ? `No templates match "${query}".`
                  : "No templates match the current filters."
                : "Create your first exam template to get started."
            }
            action={
              hasActiveFilter ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear filters
                </Button>
              ) : (
                <Button
                  onClick={() => navigate("/lecturer/exam-templates/create")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              )
            }
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((template: any) => (
              <TemplateCard
                key={template._id}
                template={template}
                onEdit={() =>
                  navigate(`/lecturer/exam-templates/${template._id}/edit`)
                }
                onTogglePublish={() =>
                  togglePublishMutation.mutate(template._id)
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
          <Card className="overflow-hidden shadow-none">
            <Table>
              <TableHeader className="hidden md:table-header-group">
                <TableRow className="bg-muted/30">
                  <TableHead className="min-w-[280px]">Template</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-32">Language</TableHead>
                  <TableHead className="w-24">Codes</TableHead>
                  <TableHead className="w-28">Duration</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((template: any) => (
                  <TemplateListRow
                    key={template._id}
                    template={template}
                    onEdit={() =>
                      navigate(`/lecturer/exam-templates/${template._id}/edit`)
                    }
                    onTogglePublish={() =>
                      togglePublishMutation.mutate(template._id)
                    }
                    onShare={() =>
                      handleOpenShare(template._id, template.templateName)
                    }
                    onDelete={() =>
                      handleOpenDelete(template._id, template.templateName)
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
        title="Delete Template"
        description={
          <>
            Are you sure you want to delete{" "}
            <strong>"{deleteTargetName}"</strong>? This action cannot be undone.
          </>
        }
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />

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
/*                              Template toolbar                              */
/* -------------------------------------------------------------------------- */

function TemplateToolbar({
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  languageFilter,
  onLanguageFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  typeFilter: string | null;
  onTypeFilterChange: (value: string | null) => void;
  languageFilter: string | null;
  onLanguageFilterChange: (value: string | null) => void;
  statusFilter: "all" | "published" | "draft";
  onStatusFilterChange: (value: "all" | "published" | "draft") => void;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search templates by name…"
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <Select
              value={typeFilter ?? "all"}
              onValueChange={(v) => onTypeFilterChange(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[125px] h-9" aria-label="Filter by exam type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EXAM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Language Filter */}
            <Select
              value={languageFilter ?? "all"}
              onValueChange={(v) => onLanguageFilterChange(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[135px] h-9" aria-label="Filter by programming language">
                <SelectValue placeholder="All Languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l} className="capitalize">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                onStatusFilterChange(v as "all" | "published" | "draft")
              }
            >
              <SelectTrigger className="w-[125px] h-9" aria-label="Filter by status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
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

function TemplateCard({
  template,
  onEdit,
  onTogglePublish,
  onShare,
  onDelete,
}: {
  template: any;
  onEdit: () => void;
  onTogglePublish?: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const codeCount = template.examCodeCount || template.examCodes?.length || 0;

  return (
    <Card className="group flex flex-col justify-between shadow-none transition-colors hover:border-foreground/20 rounded-xl min-h-[210px]">
      <div>
        <CardHeader className="flex-row items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            {/* Language Icon Chip */}
            <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 border border-border/60 p-2">
              <FileIcon
                language={template.language}
                className="w-5 h-5 object-contain"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <h3
                className="font-semibold text-base leading-snug text-foreground line-clamp-1"
                title={template.templateName}
              >
                {template.templateName}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="primary" className="text-[11px] px-2 py-0.5">
                  {template.examType}
                </Badge>
                {template.isPublished ? (
                  <Badge variant="success" className="text-[11px] px-2 py-0.5">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-[11px] px-2 py-0.5">
                    Draft
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <TemplateActions
            isPublished={template.isPublished}
            onTogglePublish={onTogglePublish}
            onShare={onShare}
            onDelete={onDelete}
          />
        </CardHeader>

        <CardContent className="px-5 py-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>{template.duration} mins</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>
                {codeCount} exam code{codeCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </CardContent>
      </div>

      <CardFooter className="border-t border-border p-3.5 bg-muted/10 mt-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="w-full justify-center text-xs h-8.5 font-medium"
        >
          <Edit className="w-3.5 h-3.5 mr-1.5" />
          Edit Template
        </Button>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                List table                                  */
/* -------------------------------------------------------------------------- */

function TemplateListRow({
  template,
  onEdit,
  onTogglePublish,
  onShare,
  onDelete,
}: {
  template: any;
  onEdit: () => void;
  onTogglePublish?: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const codeCount = template.examCodeCount || template.examCodes?.length || 0;

  return (
    <TableRow>
      <TableCell className="min-w-[280px]">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {template.templateName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground md:hidden">
            <span>
              {codeCount} code{codeCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{template.language}</span>
            <span aria-hidden="true">·</span>
            <span>{template.duration} min</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 md:hidden">
            <Badge variant="primary">{template.examType}</Badge>
            {template.isPublished ? (
              <Badge variant="success">Published</Badge>
            ) : (
              <Badge variant="default">Draft</Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="primary">{template.examType}</Badge>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        <span className="inline-flex items-center gap-1.5 capitalize text-xs font-medium text-foreground">
          <FileIcon
            language={template.language}
            className="w-4 h-4 object-contain"
          />
          {template.language}
        </span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {codeCount}
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {template.duration} min
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {template.isPublished ? (
          <Badge variant="success">Published</Badge>
        ) : (
          <Badge variant="default">Draft</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <TemplateActions
            isPublished={template.isPublished}
            onTogglePublish={onTogglePublish}
            onShare={onShare}
            onDelete={onDelete}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function TemplateActions({
  isPublished,
  onTogglePublish,
  onShare,
  onDelete,
}: {
  isPublished?: boolean;
  onTogglePublish?: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label="Template actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onTogglePublish && (
          <DropdownMenuItem onClick={onTogglePublish}>
            {isPublished ? (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Make draft
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Publish
              </>
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
