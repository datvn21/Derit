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
  const filtered = useMemo(
    () =>
      templates.filter((t: any) =>
        t.templateName.toLowerCase().includes(query.toLowerCase()),
      ),
    [templates, query],
  );

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
      {/* Header */}
      <div>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Exam Templates</h1>
            <div className="flex items-center gap-3 ">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 w-52"
                />
              </div>
              <Button
                onClick={() => navigate("/lecturer/exam-templates/create")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">
              {query ? "No templates found" : "No templates yet"}
            </h3>
            {!query && (
              <>
                <p className="text-muted-foreground mb-6">
                  Create your first exam template to get started
                </p>
                <Button
                  onClick={() => navigate("/lecturer/exam-templates/create")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((template: any) => (
              <div
                key={template._id}
                className="bg-card rounded-lg border border-border hover:border-foreground/20 transition-colors"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">
                        {template.templateName}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{template.examType}</Badge>
                        {template.isPublished && (
                          <Badge variant="success">Published</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
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

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/lecturer/exam-templates/${template._id}/edit`,
                        )
                      }
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenShare(template._id, template.templateName)
                      }
                      aria-label={`Share ${template.templateName}`}
                      title="Share template"
                    >
                      <Share2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenDelete(template._id, template.templateName)
                      }
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete ${template.templateName}`}
                      title={`Delete ${template.templateName}`}
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
