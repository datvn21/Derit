/**
 * Step 4 - Review & save.
 *
 * Read-only summary of everything assembled in steps 1–3. Lists each
 * issue found so the lecturer can click through to the failing section.
 */
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Code2,
  BookOpen,
  Save,
} from "lucide-react";
import type { UseTemplateStateResult } from "./useTemplateState";
import { validateAll, type WizardStepId } from "./steps";

export function StepReview({
  state,
  onJumpTo,
  isSubmitting,
  onSubmit,
  onSaveDraft,
  submitLabel,
}: {
  state: UseTemplateStateResult;
  onJumpTo: (step: WizardStepId) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onSaveDraft: () => void;
  submitLabel: string;
}) {
  const { meta, examCodes } = state;
  const validations = validateAll(meta, examCodes);
  const allValid = validations.info.ok && validations.codes.ok;

  const totalQuestions = examCodes.reduce(
    (sum, c) => sum + c.questions.length,
    0,
  );
  const totalTests = examCodes.reduce(
    (sum, c) => sum + c.questions.reduce((s, q) => s + q.testCases.length, 0),
    0,
  );
  const totalStarterFiles = examCodes.reduce(
    (sum, c) =>
      sum + c.questions.reduce((s, q) => s + q.starterFiles.length, 0),
    0,
  );

  return (
    <section className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5">
      <header className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-muted shrink-0 text-foreground">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground leading-tight">
            Review &amp; save
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Confirm everything below. Fix any flagged items before saving.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryTile
          icon={BookOpen}
          label="Template"
          rows={[
            { label: "Name", value: meta.templateName || "(unnamed)" },
            { label: "Type", value: meta.examType },
            { label: "Language", value: meta.language },
            {
              label: "Duration",
              value: `${meta.duration} min`,
            },
          ]}
        />
        <SummaryTile
          icon={FileText}
          label="Coverage"
          rows={[
            { label: "Exam codes", value: `${examCodes.length}` },
            { label: "Questions", value: `${totalQuestions}` },
            { label: "Test cases", value: `${totalTests}` },
            { label: "Starter files", value: `${totalStarterFiles}` },
          ]}
        />
      </div>

      {/* Per-code breakdown */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Codes</h3>
        {examCodes.map((c, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-muted/30 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">Code {c.codeNumber}</p>
              <Badge variant={c.pdfFile || c.pdfUrl ? "success" : "warning"}>
                {c.pdfFile || c.pdfUrl ? "PDF ready" : "PDF missing"}
              </Badge>
            </div>
            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
              {c.questions.map((q) => (
                <li key={q.questionNumber} className="flex items-center gap-2">
                  <span className="w-4 text-right text-muted-foreground">
                    {q.questionNumber}.
                  </span>
                  <span className="flex-1 truncate text-foreground">
                    {q.title || "(untitled)"}
                  </span>
                  <span className="shrink-0">
                    {q.testCases.length} TC · {q.starterFiles.length} files
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Validation summary */}
      {allValid ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          Looks good. Ready to save.
        </div>
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            Fix these before saving
          </div>
          <ul className="space-y-1 text-foreground">
            {!validations.info.ok && (
              <StepIssueRow
                label="Template info"
                issues={validations.info.issues}
                onJump={() => onJumpTo("info")}
              />
            )}
            {!validations.codes.ok && (
              <StepIssueRow
                label="Codes & questions"
                issues={validations.codes.issues}
                onJump={() => onJumpTo("codes")}
              />
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          className="min-w-32"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Save draft
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || !allValid}
          className="min-w-35"
        >
          {isSubmitting ? (
            <>
              <Clock className="w-4 h-4 mr-1 animate-spin" /> Processing…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </section>
  );
}

function StepIssueRow({
  label,
  issues,
  onJump,
}: {
  label: string;
  issues: string[];
  onJump: () => void;
}) {
  return (
    <li className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">{label}:</span>
        <button
          type="button"
          onClick={onJump}
          className="text-xs text-primary hover:underline"
        >
          Go fix
        </button>
      </div>
      <ul className="list-disc list-inside text-xs text-muted-foreground">
        {issues.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </li>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  rows,
}: {
  icon: typeof Clock;
  label: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-muted">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <dl className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-foreground font-medium truncate">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Avoid unused-import lint if `Code2` ends up unreferenced after future edits.
void Code2;
