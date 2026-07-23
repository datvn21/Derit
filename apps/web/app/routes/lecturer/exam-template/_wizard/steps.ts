/**
 * Wizard step definitions and per-step validation.
 *
 * Steps are the only place that defines how the wizard is split.
 * Components import `STEPS` to render navigation; `validateStep`
 * gates the "Next" button so we don't ship an empty template.
 *
 * Step 2 (Codes & questions) is intentionally one step: setting up a
 * code without its questions is meaningless. Both validations run
 * before the user can proceed to Review.
 */
import type { TemplateMeta } from "./useTemplateState";
import type { ExamCode, Question, TestCase } from "./types";

export type WizardStepId = "info" | "codes" | "review";

export interface WizardStep {
  id: WizardStepId;
  label: string;
  description: string;
}

export const STEPS: WizardStep[] = [
  {
    id: "info",
    label: "Template info",
    description: "Name, type, language, duration.",
  },
  {
    id: "codes",
    label: "Codes & questions",
    description: "Per code: PDF + questions + tests + starter files.",
  },
  {
    id: "review",
    label: "Review & save",
    description: "Confirm everything before saving.",
  },
];

export interface StepValidation {
  ok: boolean;
  issues: string[];
}

export function validateInfoStep(meta: TemplateMeta): StepValidation {
  const issues: string[] = [];
  if (!meta.templateName.trim()) {
    issues.push("Template name is required.");
  }
  if (!meta.duration || meta.duration <= 0) {
    issues.push("Duration must be a positive number.");
  }
  return { ok: issues.length === 0, issues };
}

export function validateCodesStep(codes: ExamCode[]): StepValidation {
  const issues: string[] = [];
  if (codes.length === 0) {
    issues.push("Add at least one exam code.");
  }

  codes.forEach((c, i) => {
    if (!c.codeNumber.trim()) {
      issues.push(`Code #${i + 1}: code number is required.`);
    }
    if (!c.pdfFile && !c.pdfUrl) {
      issues.push(`Code ${c.codeNumber || `#${i + 1}`}: PDF is required.`);
    }
    c.questions.forEach((q: Question) => {
      if (!q.title.trim()) {
        issues.push(
          `Code ${c.codeNumber} · Q${q.questionNumber}: title is required.`,
        );
      }
      q.testCases.forEach((tc: TestCase, ti: number) => {
        if (!tc.expectedOutput.trim()) {
          issues.push(
            `Code ${c.codeNumber} · Q${q.questionNumber} · TC${ti + 1}: expected output required.`,
          );
        }
      });
    });
  });

  return { ok: issues.length === 0, issues };
}

/** Aggregate validation across the first two steps (used by Review). */
export function validateAll(
  meta: TemplateMeta,
  codes: ExamCode[],
): Record<WizardStepId, StepValidation> {
  return {
    info: validateInfoStep(meta),
    codes: validateCodesStep(codes),
    review: { ok: true, issues: [] },
  };
}