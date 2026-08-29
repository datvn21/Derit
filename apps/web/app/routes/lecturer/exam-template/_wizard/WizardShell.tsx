/**
 * WizardShell - orchestrates step navigation, persistence of the active
 * step (per-code / per-question), and the submit pipeline (PDF upload
 * retry + mutation).
 *
 * Both Create and Edit pages wrap their initial payload and submit
 * logic in this shell. Differences between them live in the props.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Save, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { uploadAPI } from "~/lib/api";

import {
  useTemplateState,
  type UseTemplateStateResult,
} from "./useTemplateState";
import { validateAll, STEPS, type WizardStepId } from "./steps";
import { StepIndicator } from "./StepIndicator";
import { StepTemplateInfo } from "./StepTemplateInfo";
import { StepCodesAndQuestions } from "./StepCodesAndQuestions";
import { StepReview } from "./StepReview";

export interface WizardShellProps {
  title: string;
  backHref: string;
  state: UseTemplateStateResult;
  submit: (
    payload: {
      templateName: string;
      examType: string;
      language: string;
      duration: number;
      isPublished?: boolean;
      examCodes: Array<{
        codeNumber: string;
        pdfUrl: string;
        questions: unknown[];
      }>;
    },
    options?: { isDraft?: boolean },
  ) => Promise<void>;
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
  const [quickTarget, setQuickTarget] = useState("");

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

  const goTo = useCallback((next: WizardStepId) => {
    setStep(next);
    setVisited((prev) => new Set(prev).add(next));
  }, []);

  const canGoNext = (): boolean => {
    if (step === "info") return validations.info.ok;
    if (step === "codes") return validations.codes.ok;
    return true;
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isLast = step === "review";
  const isFirst = step === "info";
  const nextIssues =
    step === "info"
      ? validations.info.issues
      : step === "codes"
        ? validations.codes.issues
        : [];
  const nextDisabled = !canGoNext();
  const nextTooltip = nextDisabled
    ? [
        "Complete these items before continuing:",
        ...nextIssues.slice(0, 3).map((issue) => `• ${issue}`),
        ...(nextIssues.length > 3
          ? [`• And ${nextIssues.length - 3} more item(s)`]
          : []),
      ].join("\n")
    : undefined;

  const onPrimaryAction = () => {
    if (isLast) {
      void handleSave(false);
    } else {
      const next = STEPS[stepIndex + 1];
      if (next) goTo(next.id);
    }
  };

  const handleSave = async (isDraft: boolean) => {
    if (!state.meta.templateName.trim()) {
      toast.error("Please enter a template name before saving");
      return;
    }
    if (state.examCodes.length === 0) {
      toast.error("At least one exam code is required");
      return;
    }

    try {
      // 1. Upload any pending PDF files (with retry + progress toasts).
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
        return; // Stop - toast already shown.
      }

      // 2. Submit payload with uploaded URLs.
      await submit(
        {
          templateName: state.meta.templateName,
          examType: state.meta.examType,
          language: state.meta.language,
          duration: state.meta.duration,
          isPublished: !isDraft,
          examCodes: processed.map((c) => ({
            codeNumber: c.codeNumber,
            pdfUrl: c.pdfUrl,
            questions: c.questions,
          })),
        },
        { isDraft },
      );
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    }
  };

  const jumpToEditorItem = (value: string) => {
    setQuickTarget(value);
    if (!value) return;

    const codeIndex = Number(value.match(/^code-(\d+)/)?.[1]);
    if (!Number.isInteger(codeIndex)) return;
    setActiveCodeIndex(codeIndex);
    requestAnimationFrame(() => {
      document
        .getElementById(`wizard-${value}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-xs">
        <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-center px-4 sm:px-6">
          <div className="absolute left-4 flex min-w-0 justify-start sm:left-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(backHref)}
              className="h-8 rounded-md border border-border bg-muted/70 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1.5" /> Leave
            </Button>
          </div>

          <h1 className="min-w-0 max-w-[46vw] truncate text-center text-base font-semibold tracking-tight text-foreground sm:max-w-[56vw]">
            {title}
          </h1>

          <div className="absolute right-4 flex items-center gap-2 sm:right-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSave(true)}
              disabled={isSubmitting}
              className="h-8 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save draft
            </Button>
            <div className="hidden min-w-0 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:flex">
              Step {stepIndex + 1} of {STEPS.length}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pt-8 pb-24 flex flex-col gap-6">
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
            jumpTarget={quickTarget}
          />
        )}
        {step === "review" && (
          <StepReview
            state={state}
            onJumpTo={goTo}
            isSubmitting={isSubmitting}
            onSubmit={() => void handleSave(false)}
            onSaveDraft={() => void handleSave(true)}
            submitLabel={submitLabel}
          />
        )}
      </main>

      {/* Floating bottom navigation toolbar */}
      {!isLast && (
        <div className="fixed bottom-6 left-64 right-0 z-30 pointer-events-none flex justify-center px-4 sm:px-6">
          <div className="pointer-events-auto max-w-6xl w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 backdrop-blur-xs px-4 py-2.5 shadow-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const prev = STEPS[stepIndex - 1];
                if (prev) goTo(prev.id);
              }}
              disabled={isFirst}
              className="h-8 min-w-20 shrink-0"
            >
              Previous
            </Button>

            {step === "codes" && (
              <select
                value={quickTarget}
                onChange={(event) => jumpToEditorItem(event.target.value)}
                aria-label="Jump to question or test case"
                className="h-8 max-w-xs flex-1 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer"
              >
                <option value="">Jump to question or test case</option>
                {state.examCodes.map((code, codeIndex) => (
                  <optgroup
                    key={`quick-code-${codeIndex}`}
                    label={`Code ${code.codeNumber || codeIndex + 1}`}
                  >
                    {code.questions.map((question, questionIndex) => (
                      <option
                        key={`quick-question-${codeIndex}-${questionIndex}`}
                        value={`code-${codeIndex}-question-${questionIndex}`}
                      >
                        Q{questionIndex + 1}: {question.title}
                      </option>
                    ))}
                    {code.questions.flatMap((question, questionIndex) =>
                      question.testCases.map((_, testCaseIndex) => (
                        <option
                          key={`quick-test-${codeIndex}-${questionIndex}-${testCaseIndex}`}
                          value={`code-${codeIndex}-question-${questionIndex}-testcase-${testCaseIndex}`}
                        >
                          Q{questionIndex + 1} · Test case {testCaseIndex + 1}
                        </option>
                      )),
                    )}
                  </optgroup>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <span
                title={nextTooltip}
                tabIndex={nextDisabled ? 0 : undefined}
                aria-label={nextTooltip}
                className={nextDisabled ? "cursor-not-allowed" : undefined}
              >
                <Button
                  size="sm"
                  onClick={onPrimaryAction}
                  disabled={nextDisabled}
                  className="h-8 min-w-20"
                >
                  Next
                </Button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
