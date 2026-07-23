/**
 * WizardShell — orchestrates step navigation, persistence of the active
 * step (per-code / per-question), and the submit pipeline (PDF upload
 * retry + mutation).
 *
 * Both Create and Edit pages wrap their initial payload and submit
 * logic in this shell. Differences between them live in the props.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { uploadAPI } from "~/lib/api";

import { useTemplateState, type UseTemplateStateResult } from "./useTemplateState";
import { validateAll, STEPS, type WizardStepId } from "./steps";
import { StepIndicator } from "./StepIndicator";
import { StepTemplateInfo } from "./StepTemplateInfo";
import { StepCodesAndQuestions } from "./StepCodesAndQuestions";
import { StepReview } from "./StepReview";

export interface WizardShellProps {
  title: string;
  backHref: string;
  state: UseTemplateStateResult;
  submit: (payload: {
    templateName: string;
    examType: string;
    language: string;
    duration: number;
    examCodes: Array<{
      codeNumber: string;
      pdfUrl: string;
      questions: unknown[];
    }>;
  }) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
}

export function WizardShell({
  title,
  backHref,
  state,
  submit,
  isSubmitting,
  submitLabel,
}: WizardShellProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStepId>("info");
  const [visited, setVisited] = useState<Set<WizardStepId>>(new Set(["info"]));
  const [activeCodeIndex, setActiveCodeIndex] = useState(0);

  // Clamp active code if codes list shrinks.
  useEffect(() => {
    if (activeCodeIndex >= state.examCodes.length) {
      setActiveCodeIndex(Math.max(0, state.examCodes.length - 1));
    }
  }, [state.examCodes.length, activeCodeIndex]);

  const validations = useMemo(
    () => validateAll(state.meta, state.examCodes),
    [state.meta, state.examCodes],
  );

  const goTo = useCallback(
    (next: WizardStepId) => {
      setStep(next);
      setVisited((prev) => new Set(prev).add(next));
    },
    [],
  );

  const canGoNext = (): boolean => {
    if (step === "info") return validations.info.ok;
    if (step === "codes") return validations.codes.ok;
    return true;
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isLast = step === "review";
  const isFirst = step === "info";

  const onPrimaryAction = () => {
    if (isLast) {
      void handleSubmit();
    } else {
      const next = STEPS[stepIndex + 1];
      if (next) goTo(next.id);
    }
  };

  const handleSubmit = async () => {
    // 1. Upload any pending PDF files (with retry + progress toasts).
    try {
      const processed = [...state.examCodes];
      const uploads = processed.map(async (code, i) => {
        if (!code.pdfFile) return { index: i, url: code.pdfUrl };
        const maxRetries = 3;
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            toast.loading(
              `Uploading PDF for code ${code.codeNumber}… (${attempt}/${maxRetries})`,
              { id: `upload-${code.codeNumber}` },
            );
            const res = await uploadAPI.uploadPdf(code.pdfFile, (progress) => {
              toast.loading(
                `Uploading PDF for code ${code.codeNumber}… ${progress}%`,
                { id: `upload-${code.codeNumber}` },
              );
            });
            toast.success(`PDF for code ${code.codeNumber} uploaded`, {
              id: `upload-${code.codeNumber}`,
            });
            return { index: i, url: res.data.url };
          } catch (err: any) {
            lastError = err;
            if (attempt === maxRetries) {
              toast.error(
                `Failed to upload PDF for code ${code.codeNumber}: ${err.response?.data?.error || err.message || "Unknown error"}`,
                { id: `upload-${code.codeNumber}` },
              );
              throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
        throw lastError;
      });

      try {
        const results = await Promise.all(uploads);
        results.forEach(({ index, url }) => {
          processed[index].pdfUrl = url;
        });
      } catch {
        return; // Stop — toast already shown.
      }

      // 2. Submit payload with uploaded URLs.
      await submit({
        templateName: state.meta.templateName,
        examType: state.meta.examType,
        language: state.meta.language,
        duration: state.meta.duration,
        examCodes: processed.map((c) => ({
          codeNumber: c.codeNumber,
          pdfUrl: c.pdfUrl,
          questions: c.questions,
        })),
      });
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(backHref)}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {title}
            </h1>
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            Step {stepIndex + 1} of {STEPS.length}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        <StepIndicator
          activeStep={step}
          visited={visited}
          validations={validations}
          onStepClick={goTo}
        />

        {step === "info" && <StepTemplateInfo state={state} />}
        {step === "codes" && (
          <StepCodesAndQuestions
            state={state}
            activeCodeIndex={activeCodeIndex}
            onActiveCodeChange={setActiveCodeIndex}
          />
        )}
        {step === "review" && (
          <StepReview
            state={state}
            onJumpTo={goTo}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
          />
        )}

        {/* Bottom nav (only when not on Review — Review has its own submit). */}
        {!isLast && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => {
                const prev = STEPS[stepIndex - 1];
                if (prev) goTo(prev.id);
              }}
              disabled={isFirst}
            >
              Previous
            </Button>
            <Button onClick={onPrimaryAction} disabled={!canGoNext()}>
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}