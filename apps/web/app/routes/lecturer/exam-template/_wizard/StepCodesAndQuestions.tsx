/**
 * Step 2 — Codes & questions.
 *
 * Layout: a single surface with three distinct vertical sections.
 * 1. Tab strip — one tab per code, plus an explicit Add code button.
 * 2. Identity card — name, status, and PDF for the active code.
 *    The card is split into two rows so naming and PDF never collide.
 * 3. Questions list — per-question accordion, expanded by default
 *    for the first question so the user can see the shape.
 *
 * Status indicators (ready / incomplete) render via `<Badge>` variants so
 * the wizard follows the same status-voice as the rest of the app.
 */
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Plus,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { UseTemplateStateResult } from "./useTemplateState";
import type { ExamCode } from "./types";
import { QuestionsEditor } from "./QuestionsEditor";
import { cn } from "~/lib/utils";

export function StepCodesAndQuestions({
  state,
  activeCodeIndex,
  onActiveCodeChange,
  jumpTarget,
}: {
  state: UseTemplateStateResult;
  activeCodeIndex: number;
  onActiveCodeChange: (i: number) => void;
  jumpTarget?: string;
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
      {/* ── 1. Tab strip ───────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Exam codes"
        className="sticky top-0 z-20 flex items-end gap-1 px-4 pt-2 bg-card border-b border-border overflow-x-auto overflow-y-hidden"
      >
        {examCodes.map((c, ci) => {
          const active = ci === activeCodeIndex;
          const ready = checkCodeReady(c);
          return (
            <button
              key={ci}
              type="button"
              role="tab"
              aria-selected={active}
              data-state={active ? "active" : "inactive"}
              onClick={() => onActiveCodeChange(ci)}
              className={cn(
                "group relative -mb-px flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-[background-color,color,border-color] duration-(--motion-fast) ease-(--motion-ease) cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span className="truncate max-w-32">
                {c.codeNumber ? `Code ${c.codeNumber}` : `Code ${ci + 1}`}
              </span>
              {ready ? (
                <Badge variant="success" className="text-[10px]">
                  Ready
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[10px]">
                  Incomplete
                </Badge>
              )}
            </button>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={addExamCode}
          className="ml-2 mb-1.5"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add code
        </Button>
      </div>

      {/* ── 2. Identity card ───────────────────────────────────────────── */}
      {code && (
        <div className="px-6 py-5 border-b border-border bg-card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-row gap-1">
                <Label
                  htmlFor="codeNumber"
                  className="text-xs text-muted-foreground"
                >
                  Code label
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
                  placeholder="e.g. A, B, 1, 2"
                  className="h-8 w-24 text-sm font-mono"
                />
              </div>
            </div>

            <CodeStatusBadge code={code} />

            {examCodes.length > 1 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete code ${code.codeNumber || activeCodeIndex + 1}? All questions inside will be removed.`,
                    )
                  ) {
                    removeExamCode(activeCodeIndex);
                  }
                }}
                className="shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete code
              </Button>
            )}
          </div>

          <PdfField
            code={code}
            onChange={(f) => setPdfFile(activeCodeIndex, f)}
            onPreview={openPreview}
          />
        </div>
      )}

      {/* ── 3. Questions list ──────────────────────────────────────────── */}
      {code && (
        <div className="px-6 py-6 bg-background">
          <QuestionsEditor
            state={state}
            activeCodeIndex={activeCodeIndex}
            jumpTarget={jumpTarget}
          />
        </div>
      )}

      <PdfPreviewDialog url={previewPdf} onClose={() => setPreviewPdf(null)} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Code status                                 */
/* -------------------------------------------------------------------------- */

function checkCodeReady(code: ExamCode): boolean {
  const hasPdf = !!(code.pdfFile || code.pdfUrl);
  const hasQuestions = code.questions.length > 0;
  return hasPdf && hasQuestions;
}

function CodeStatusBadge({ code }: { code: ExamCode }) {
  const ready = checkCodeReady(code);
  if (ready) {
    return (
      <Badge variant="success">
        <CheckCircle2 className="w-3 h-3" /> Ready
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <AlertCircle className="w-3 h-3" /> Incomplete
    </Badge>
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
  const filename = code.pdfFile?.name ?? "Currently saved PDF";

  if (!hasFile) {
    return (
      <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-border rounded-md bg-muted/40 cursor-pointer hover:bg-muted hover:border-foreground/30 transition-colors">
        <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-foreground">
            Upload reference PDF
          </span>
          <span className="text-xs text-muted-foreground">
            The paper / question sheet students will read during the exam.
          </span>
        </div>
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
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-md bg-muted/40">
      <FileText className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm font-sans text-foreground truncate flex-1 min-w-0">
        {filename}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onPreview}>
        Preview
      </Button>
      <label className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 rounded hover:bg-muted transition-colors shrink-0">
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PDF preview dialog                             */
/* -------------------------------------------------------------------------- */

function PdfPreviewDialog({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-none w-[90vw] h-[90vh] p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>PDF preview</DialogTitle>
        </DialogHeader>
        <div className="h-[calc(90vh-7rem)] bg-muted">
          {url && (
            <iframe src={url} className="w-full h-full" title="PDF preview" />
          )}
        </div>
        <DialogFooter className="border-t border-border px-4 py-3">
          <Button variant="outline" asChild>
            <a href={url ?? "#"} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Open in new tab
            </a>
          </Button>
          <DialogClose asChild>
            <Button variant="default">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
