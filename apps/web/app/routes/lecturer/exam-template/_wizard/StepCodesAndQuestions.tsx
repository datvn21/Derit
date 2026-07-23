/**
 * Step 2 — Codes & questions.
 *
 * Combined from the old Step 2 (exam codes) and Step 3 (questions).
 * Code tabs at the top let you switch between paper versions, and the
 * currently active code's PDF + question accordion render below — so
 * you can set up a complete paper without leaving this step.
 */
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Plus,
  Upload,
  Eye,
  FileText,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import type { UseTemplateStateResult } from "./useTemplateState";
import type { ExamCode } from "./types";
import { QuestionsEditor } from "./QuestionsEditor";
import { cn } from "~/lib/utils";

export function StepCodesAndQuestions({
  state,
  activeCodeIndex,
  onActiveCodeChange,
}: {
  state: UseTemplateStateResult;
  activeCodeIndex: number;
  onActiveCodeChange: (i: number) => void;
}) {
  const { examCodes, addExamCode, removeExamCode, setPdfFile } = state;
  const code = examCodes[activeCodeIndex];
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);

  const openPreview = () => {
    if (!code) return;
    if (code.pdfFile) setPreviewPdf(URL.createObjectURL(code.pdfFile));
    else if (code.pdfUrl) setPreviewPdf(code.pdfUrl);
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Code tabs (sticky so they stay visible while scrolling questions) */}
      <div
        role="tablist"
        aria-label="Exam codes"
        className="sticky top-0 z-20 flex items-end overflow-x-auto px-2 bg-card border-b border-border"
      >
        {examCodes.map((c, ci) => {
          const active = ci === activeCodeIndex;
          const filled = !!(c.pdfFile || c.pdfUrl);
          const ready = filled && c.questions.length > 0;
          return (
            <button
              key={ci}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onActiveCodeChange(ci)}
              className={cn(
                "group relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-(--motion-fast) ease-(--motion-ease) cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground group-aria-selected:text-primary tabular-nums">
                {String(ci + 1).padStart(2, "0")}
              </span>
              <span className="truncate max-w-40">
                {c.codeNumber ? `Code ${c.codeNumber}` : "Untitled code"}
              </span>
              {ready ? (
                <CheckCircle2
                  className="w-3 h-3 text-success shrink-0"
                  aria-label="Ready"
                />
              ) : (
                <AlertCircle
                  className="w-3 h-3 text-warning shrink-0"
                  aria-label="Incomplete"
                />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={addExamCode}
          className="ml-1 inline-flex items-center gap-1 px-2 py-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-(--motion-fast) ease-(--motion-ease) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add code
        </button>
      </div>

      {/* Active code identity row + PDF (single row, dense) */}
      {code && (
        <div className="px-4 py-3 flex items-center gap-2 bg-muted/20 border-b border-border flex-wrap">
          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <span className="font-mono tabular-nums">{activeCodeIndex + 1}</span>
            <span className="opacity-50">/</span>
            <span className="font-mono tabular-nums">{examCodes.length}</span>
          </div>

          <div className="h-4 w-px bg-border shrink-0" />

          <div className="inline-flex items-center gap-1.5 shrink-0">
            <Label
              htmlFor="codeNumber"
              className="text-xs text-muted-foreground"
            >
              Code
            </Label>
            <Input
              id="codeNumber"
              value={code.codeNumber}
              onChange={(e) =>
                state.updateExamCodeField(
                  activeCodeIndex,
                  "codeNumber",
                  e.target.value,
                )
              }
              placeholder="1"
              className="h-7 w-16 text-xs font-mono tabular-nums"
            />
          </div>

          <div className="h-4 w-px bg-border shrink-0" />

          <div className="ml-auto flex items-center gap-2 min-w-0 max-w-full">
            <PdfField
              code={code}
              onChange={(f) => setPdfFile(activeCodeIndex, f)}
              onPreview={openPreview}
            />
          </div>

          {examCodes.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete code ${code.codeNumber || "(empty)"}? All questions inside will be removed.`,
                  )
                ) {
                  removeExamCode(activeCodeIndex);
                }
              }}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              aria-label="Delete this code"
              title="Delete this code"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Active code: questions */}
      {code && (
        <div className="px-4 py-4 bg-background">
          <QuestionsEditor state={state} activeCodeIndex={activeCodeIndex} />
        </div>
      )}

      <Dialog
        open={!!previewPdf}
        onOpenChange={(open) => !open && setPreviewPdf(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="!max-w-none w-[90vw] h-[90vh] p-0 pb-2 gap-0"
        >
          <DialogTitle></DialogTitle>
          <div className="h-[85vh]">
            {previewPdf && (
              <iframe
                src={previewPdf}
                className="w-full h-full rounded-t-md"
                title="PDF preview"
              />
            )}
          </div>
          <DialogFooter className="h-[5vh] flex items-center border-t border-border px-4">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PDF field                                     */
/* -------------------------------------------------------------------------- */

function PdfField({
  code,
  onChange,
  onPreview,
}: {
  code: Pick<ExamCode, "pdfFile" | "pdfUrl">;
  onChange: (file: File) => void;
  onPreview: () => void;
}) {
  const hasFile = !!code.pdfFile || !!code.pdfUrl;
  const filename = code.pdfFile?.name;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Upload className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

      {hasFile ? (
        <>
          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-mono text-foreground truncate min-w-0 flex-1">
            {filename ?? "Currently saved PDF"}
          </span>
          <label
            className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted transition-colors duration-(--motion-fast) ease-(--motion-ease) shrink-0"
            title="Replace PDF"
          >
            Replace
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onChange(f);
                e.target.value = "";
              }}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPreview}
            className="h-6 px-2 text-[11px] shrink-0"
            aria-label="Preview PDF"
          >
            <Eye className="w-3 h-3 mr-1" /> Preview
          </Button>
        </>
      ) : (
        <label
          className="inline-flex items-center gap-1.5 px-2 py-1 border border-dashed border-border rounded text-[11px] text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors duration-(--motion-fast) ease-(--motion-ease) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0"
          title="Upload PDF"
        >
          Upload PDF
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onChange(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
