/**
 * Edit an existing exam template.
 *
 * Loads the template on mount, hydrates the wizard state via
 * `useTemplateState.hydrate`, and submits the update mutation on save.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { examTemplateAPI } from "~/lib/api";
import { PageLoading } from "~/components/ui/page-loading";
import { useTemplateState } from "./_wizard/useTemplateState";
import { WizardShell } from "./_wizard/WizardShell";
import type { ExamCode, ExamType, Language } from "./_wizard/types";

export default function ExamTemplateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasInitializedRef = useRef(false);

  const state = useTemplateState();

  // Load existing template
  const { data: templateData, isLoading } = useQuery({
    queryKey: ["exam-template", id],
    queryFn: () => examTemplateAPI.getById(id!),
    enabled: !!id,
  });

  // Hydrate wizard state once on first data arrival
  useEffect(() => {
    if (templateData?.data?.template && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const t = templateData.data.template;

      state.hydrate({
        meta: {
          templateName: t.templateName,
          examType: t.examType as ExamType,
          language: t.language as Language,
          duration: t.duration,
        },
        codes: (t.examCodes ?? []).map((code: any): ExamCode => ({
          codeNumber: code.codeNumber,
          pdfUrl: code.pdfUrl,
          pdfFile: null,
          questions: (code.questions ?? []).map((q: any) => ({
            questionNumber: q.questionNumber,
            title: q.title ?? "",
            testCases: (q.testCases ?? []).map((tc: any) => ({
              input: tc.input ?? "",
              expectedOutput: tc.expectedOutput ?? "",
              isHidden: !!tc.isHidden,
              testFile: tc.testFile?.content
                ? { name: tc.testFile.name, content: tc.testFile.content }
                : undefined,
              extraFiles: (tc.extraFiles ?? []).map((ef: any) => ({
                name: ef.name,
                content: ef.content,
              })),
            })),
            starterFiles: (q.starterFiles ?? []).map((sf: any) => ({
              name: sf.name,
              content: sf.content,
              canDownload: sf.canDownload ?? false,
            })),
            defaultMainFile: q.defaultMainFile || undefined,
          })),
        })),
      });
    }
  }, [templateData, state]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof examTemplateAPI.update>[1]) =>
      examTemplateAPI.update(id!, data),
    onSuccess: () => {
      toast.success("Template updated successfully");
      navigate("/lecturer/exam-templates");
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(
        error.response?.data?.error || "Failed to update template",
      );
      setIsSubmitting(false);
    },
  });

  const submit = async (payload: Parameters<typeof examTemplateAPI.update>[1]) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync(payload);
    } catch {
      // Error already toasted; reset submitting so user can retry.
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <PageLoading label="Loading template…" />;
  }

  if (!templateData?.data?.template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Template not found.</p>
      </div>
    );
  }

  return (
    <WizardShell
      title="Edit exam template"
      backHref="/lecturer/exam-templates"
      state={state}
      submit={submit}
      isSubmitting={isSubmitting || updateMutation.isPending}
      submitLabel="Save changes"
    />
  );
}