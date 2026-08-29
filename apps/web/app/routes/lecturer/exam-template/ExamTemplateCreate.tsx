/**
 * Create a new exam template.
 *
 * Wraps the wizard shell with the create-mutation. State management
 * lives in `useTemplateState`; per-step UI lives under `_wizard/`.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { examTemplateAPI } from "~/lib/api";
import { useTemplateState } from "./_wizard/useTemplateState";
import { WizardShell } from "./_wizard/WizardShell";

export default function ExamTemplateCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const state = useTemplateState();

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof examTemplateAPI.create>[0]) =>
      examTemplateAPI.create(data),
    onError: (error: {
      response?: { data?: { error?: string } };
      message?: string;
    }) => {
      toast.error(error.response?.data?.error || "Failed to create template");
      setIsSubmitting(false);
    },
  });

  const submit = async (
    payload: Parameters<typeof examTemplateAPI.create>[0],
    options?: { isDraft?: boolean },
  ) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        ...payload,
        isPublished: !options?.isDraft,
      });
      toast.success(
        options?.isDraft
          ? "Draft saved successfully"
          : "Template created successfully",
      );
      navigate("/lecturer/exam-templates");
    } catch {
      // Error already toasted in onError; ensure button re-enables.
      setIsSubmitting(false);
    }
  };

  return (
    <WizardShell
      title="Create exam template"
      backHref="/lecturer/exam-templates"
      state={state}
      submit={submit}
      isSubmitting={isSubmitting || createMutation.isPending}
      submitLabel="Create template"
    />
  );
}
