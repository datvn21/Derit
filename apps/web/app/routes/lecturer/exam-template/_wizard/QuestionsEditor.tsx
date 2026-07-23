/**
 * `QuestionsEditor` — renders the per-question accordion list for the
 * currently active exam code. Used inside `StepCodesAndQuestions`
 * (codes + questions are combined into a single wizard step).
 *
 * Two-level tree: question accordion > (test cases as inline rows +
 * starter files as compact chips + per-row hidden files). Flat inside
 * an accordion — no nested boxed cards.
 */
import { useState, type ChangeEvent } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
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
  Trash2,
  Upload,
  FileText,
  Star,
  Download,
  Code2,
  ChevronDown,
  AlertTriangle,
  Eye,
} from "lucide-react";
import type { UseTemplateStateResult } from "./useTemplateState";
import {
  STARTER_FILE_ACCEPT,
  TEST_FILE_ACCEPT,
  EXTRA_FILE_ACCEPT,
  type StarterFile,
} from "./types";
import { cn } from "~/lib/utils";

export function QuestionsEditor({
  state,
  activeCodeIndex,
}: {
  state: UseTemplateStateResult;
  activeCodeIndex: number;
}) {
  const { examCodes } = state;
  const code = examCodes[activeCodeIndex];
  if (!code) return null;

  const total = code.questions.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground">
          {total} question{total === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => state.addQuestion(activeCodeIndex)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add question
        </Button>
      </div>

      {code.questions.map((q, qi) => (
        <QuestionAccordion
          key={qi}
          index={qi + 1}
          total={total}
          question={q}
          onTitleChange={(v) =>
            state.updateQuestion(activeCodeIndex, qi, "title", v)
          }
          onRemove={() => {
            if (
              window.confirm(
                `Delete Q${q.questionNumber} from code ${code.codeNumber || "(empty)"}?`,
              )
            ) {
              state.removeQuestion(activeCodeIndex, qi);
            }
          }}
          {...questionSlotProps(state, activeCodeIndex, qi)}
        />
      ))}
    </div>
  );
}

function questionSlotProps(
  state: UseTemplateStateResult,
  codeIndex: number,
  qIndex: number,
) {
  return {
    onAddTestCase: () => state.addTestCase(codeIndex, qIndex),
    onRemoveTestCase: (ti: number) =>
      state.removeTestCase(codeIndex, qIndex, ti),
    onUpdateTestCase: <
      K extends
        "input" | "expectedOutput" | "isHidden" | "testFile" | "extraFiles",
    >(
      ti: number,
      field: K,
      value: any,
    ) => state.updateTestCase(codeIndex, qIndex, ti, field, value),
    onAddStarterFile: (file: StarterFile) =>
      state.addStarterFile(codeIndex, qIndex, file),
    onRemoveStarterFile: (fi: number) =>
      state.removeStarterFile(codeIndex, qIndex, fi),
    onToggleStarterDownload: (fi: number) =>
      state.toggleStarterFileDownload(codeIndex, qIndex, fi),
    onSetDefaultMain: (name: string) =>
      state.setDefaultMainFile(codeIndex, qIndex, name),
  };
}

/* -------------------------------------------------------------------------- */
/*                                Question row                                */
/* -------------------------------------------------------------------------- */

type SlotHandlers = ReturnType<typeof questionSlotProps>;

function QuestionAccordion({
  index,
  total,
  question,
  onTitleChange,
  onRemove,
  onAddTestCase,
  onRemoveTestCase,
  onUpdateTestCase,
  onAddStarterFile,
  onRemoveStarterFile,
  onToggleStarterDownload,
  onSetDefaultMain,
}: {
  index: number;
  total: number;
  question: import("./types").Question;
  onTitleChange: (v: string) => void;
  onRemove: () => void;
} & SlotHandlers) {
  const [open, setOpen] = useState(index === 1);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    content: string;
  } | null>(null);

  const titleMissing = !question.title.trim();
  const testCaseIssues = question.testCases.filter(
    (tc) => !tc.expectedOutput.trim(),
  ).length;

  const hasFileInputs = question.starterFiles.some((f) => f.canDownload);

  return (
    <article
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        open ? "border-border" : "border-border hover:bg-muted/30",
      )}
    >
      <header
        className={cn(
          "group flex items-center gap-3 px-4 py-3 transition-colors",
          !open && "cursor-pointer hover:bg-muted/30",
        )}
        onClick={() => !open && setOpen(true)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-label={open ? "Collapse question" : "Expand question"}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-(--motion-fast) ease-(--motion-ease)",
              !open && "-rotate-90",
            )}
          />
        </button>

        <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-sm font-semibold shrink-0">
          {index}
        </div>

        <div className="flex-1 min-w-0">
          {open ? (
            <Input
              value={question.title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Question title"
              className="h-8 border-transparent shadow-none focus-visible:ring-0 px-0 font-medium"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="font-medium text-foreground truncate">
              {question.title || `Question ${index}`}
            </p>
          )}
        </div>

        {/* Compact meta — only when collapsed */}
        {!open && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {question.testCases.length} TC · {question.starterFiles.length}{" "}
              files
              {hasFileInputs ? " · downloadable" : ""}
            </span>
            {titleMissing && (
              <Badge variant="warning" className="text-[10px]">
                <AlertTriangle className="w-3 h-3" /> Title
              </Badge>
            )}
            {testCaseIssues > 0 && (
              <Badge variant="warning" className="text-[10px]">
                <AlertTriangle className="w-3 h-3" /> {testCaseIssues} TC
              </Badge>
            )}
          </div>
        )}

        {total > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-label={`Delete question ${index}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </header>

      {open && (
        <div className="border-t border-border px-4 py-5 flex flex-col gap-6 bg-background">
          {/* Starter files first — upload source files before defining tests */}
          <StarterFilesEditor
            files={question.starterFiles}
            defaultMainFile={question.defaultMainFile}
            onAdd={onAddStarterFile}
            onRemove={onRemoveStarterFile}
            onToggleDownload={onToggleStarterDownload}
            onSetDefault={onSetDefaultMain}
            onPreview={(f) =>
              setPreviewFile({ name: f.name, content: f.content })
            }
          />

          {/* Test cases as inline rows */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Test cases</Label>
              <Button variant="outline" size="sm" onClick={onAddTestCase}>
                <Plus className="w-3 h-3 mr-1" /> Add test case
              </Button>
            </div>
            <div className="rounded-md border border-border divide-y divide-border bg-card">
              {question.testCases.map((tc, ti) => (
                <TestCaseRow
                  key={ti}
                  index={ti}
                  testCase={tc}
                  total={question.testCases.length}
                  onRemove={() => onRemoveTestCase(ti)}
                  onUpdate={(field, value) =>
                    onUpdateTestCase(ti, field, value)
                  }
                  onPreviewFile={(f) =>
                    setPreviewFile({ name: f.name, content: f.content })
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <FilePreviewDialog
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Starter files block                           */
/* -------------------------------------------------------------------------- */

function StarterFilesEditor({
  files,
  defaultMainFile,
  onAdd,
  onRemove,
  onToggleDownload,
  onSetDefault,
  onPreview,
}: {
  files: StarterFile[];
  defaultMainFile?: string;
  onAdd: (f: StarterFile) => void;
  onRemove: (i: number) => void;
  onToggleDownload: (i: number) => void;
  onSetDefault: (name: string) => void;
  onPreview: (f: StarterFile) => void;
}) {
  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        onAdd({
          name: file.name,
          content: (e.target?.result as string) ?? "",
          canDownload: false,
        });
      reader.readAsText(file);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between min-h-7">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
          Starter files
          {files.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal ml-1 tabular-nums">
              ({files.length})
            </span>
          )}
        </Label>
        <label className="inline-flex items-center gap-1 px-2 h-6 border border-dashed border-border rounded text-[11px] text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors">
          <Upload className="w-3 h-3" />
          {files.length === 0 ? "Add files" : "Add more"}
          <input
            type="file"
            accept={STARTER_FILE_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {files.length === 0 ? (
        <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-5 border border-dashed border-border rounded-md cursor-pointer bg-muted  hover:bg-muted/50 hover:border-primary/50 transition-colors">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drop or click to upload starter files
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            .java · .cpp · .py · .js · .txt · …
          </p>
          <input
            type="file"
            accept={STARTER_FILE_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <ul className="rounded-md border border-border divide-y divide-border bg-card overflow-hidden">
          {files.map((sf, i) => {
            const isMain = defaultMainFile === sf.name;
            const ext = sf.name.split(".").pop()?.toLowerCase() ?? "";
            return (
              <li
                key={`${sf.name}-${i}`}
                className={cn(
                  "group flex items-center gap-2 px-2.5 py-1.5 transition-colors",
                  isMain ? "bg-warning/5" : "hover:bg-muted/40",
                )}
              >
                <FileText
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    isMain ? "text-warning" : "text-primary",
                  )}
                />
                <button
                  type="button"
                  onClick={() => onPreview(sf)}
                  className="truncate font-mono text-xs text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer max-w-50"
                  title={sf.name}
                >
                  {sf.name}
                </button>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-mono shrink-0">
                  {ext}
                </span>

                {isMain && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-warning shrink-0">
                    · entry
                  </span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSetDefault(sf.name)}
                    title={
                      isMain
                        ? "Default entry file (click to unset)"
                        : "Set as default entry file"
                    }
                    aria-pressed={isMain}
                    className={cn(
                      "inline-flex items-center gap-1 h-6 px-1.5 rounded text-[11px] transition-colors",
                      isMain
                        ? "bg-warning/15 text-warning hover:bg-warning/25"
                        : "text-muted-foreground hover:text-warning hover:bg-warning/10",
                    )}
                  >
                    <Star
                      className="w-3 h-3"
                      fill={isMain ? "currentColor" : "none"}
                    />
                    Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleDownload(i)}
                    title={
                      sf.canDownload
                        ? "Students can download (click to forbid)"
                        : "Click to allow students to download"
                    }
                    aria-pressed={sf.canDownload}
                    className={cn(
                      "inline-flex items-center gap-1 h-6 px-1.5 rounded text-[11px] transition-colors",
                      sf.canDownload
                        ? "bg-success/15 text-success hover:bg-success/25"
                        : "text-muted-foreground hover:text-success hover:bg-success/10",
                    )}
                  >
                    <Download className="w-3 h-3" />
                    {sf.canDownload ? "Downloadable" : "Hidden"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    title="Remove"
                    aria-label={`Remove ${sf.name}`}
                    className="w-6 h-6 rounded inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Test case row                                 */
/* -------------------------------------------------------------------------- */

function TestCaseRow({
  index,
  testCase,
  total,
  onRemove,
  onUpdate,
  onPreviewFile,
}: {
  index: number;
  testCase: import("./types").TestCase;
  total: number;
  onRemove: () => void;
  onUpdate: <
    K extends
      "input" | "expectedOutput" | "isHidden" | "testFile" | "extraFiles",
  >(
    field: K,
    value: any,
  ) => void;
  onPreviewFile: (f: { name: string; content: string }) => void;
}) {
  const outputMissing = !testCase.expectedOutput.trim();

  const handleTestFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      onUpdate("testFile", {
        name: file.name,
        content: (ev.target?.result as string) ?? "",
      });
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExtraFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    Array.from(list).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        onUpdate("extraFiles", [
          ...(
            (testCase.extraFiles ?? []) as { name: string; content: string }[]
          ).filter((f) => f.name !== file.name),
          { name: file.name, content: (ev.target?.result as string) ?? "" },
        ]);
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  return (
    <div className="px-3 py-3 flex flex-col gap-2 group/test">
      {/* Row 1 — Input / Expected output side-by-side with inline index + status */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <span className="self-start justify-self-start mt-1 inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted/60 text-muted-foreground font-mono text-xs font-semibold shrink-0 tabular-nums">
          {index + 1}
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <Textarea
            value={testCase.input}
            onChange={(e) => onUpdate("input", e.target.value)}
            placeholder="input — e.g. 5"
            spellCheck={false}
            className="text-xs font-mono leading-snug resize-y min-h-9 py-1.5 px-2.5 bg-background/60 border-border/70 focus-visible:bg-background"
            rows={2}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-0 relative">
          <Textarea
            value={testCase.expectedOutput}
            onChange={(e) => onUpdate("expectedOutput", e.target.value)}
            placeholder="expected output — e.g. 120"
            spellCheck={false}
            className={cn(
              "text-xs font-mono leading-snug resize-y min-h-9 py-1.5 px-2.5 bg-background/60 border-border/70 focus-visible:bg-background",
              outputMissing &&
                "border-warning/60 bg-warning/5 focus-visible:bg-warning/5",
              testCase.isHidden && "border-dashed",
            )}
            rows={2}
          />
          {outputMissing && (
            <span className="absolute -top-2 right-1.5 bg-card px-1 text-[9px] font-medium uppercase tracking-wider text-warning">
              missing
            </span>
          )}
        </div>
      </div>

      {/* Action bar — Hidden toggle + test file + extra files + remove */}
      <div className="flex items-center gap-2 pl-11 flex-wrap text-xs">
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
          <input
            type="checkbox"
            checked={testCase.isHidden}
            onChange={(e) => onUpdate("isHidden", e.target.checked)}
            className="rounded border-input text-primary focus:ring-ring w-3 h-3"
          />
          Hidden
        </label>

        <span className="h-3 w-px bg-border" />

        <div className="inline-flex items-center gap-1 flex-wrap">
          {testCase.testFile ? (
            <FilePill
              name={testCase.testFile.name}
              tone="warning"
              onPreview={() => onPreviewFile(testCase.testFile!)}
              onRemove={() => onUpdate("testFile", undefined)}
            />
          ) : (
            <label className="inline-flex items-center gap-1 px-1.5 h-5 border border-dashed border-border/70 rounded text-[11px] text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors">
              <Upload className="w-3 h-3" />
              Test{index + 1}.java
              <input
                type="file"
                accept={TEST_FILE_ACCEPT}
                className="hidden"
                onChange={handleTestFile}
              />
            </label>
          )}
        </div>

        <span className="h-3 w-px bg-border" />

        <div className="inline-flex items-center gap-1 flex-wrap">
          {(
            (testCase.extraFiles ?? []) as { name: string; content: string }[]
          ).map((ef) => (
            <FilePill
              key={ef.name}
              name={ef.name}
              tone="info"
              onPreview={() => onPreviewFile(ef)}
              onRemove={() =>
                onUpdate(
                  "extraFiles",
                  (
                    (testCase.extraFiles ?? []) as {
                      name: string;
                      content: string;
                    }[]
                  ).filter((f) => f.name !== ef.name),
                )
              }
            />
          ))}
          <label className="inline-flex items-center gap-1 px-1.5 h-5 border border-dashed border-border/70 rounded text-[11px] text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors">
            <Plus className="w-3 h-3" />
            Extra
            <input
              type="file"
              accept={EXTRA_FILE_ACCEPT}
              multiple
              className="hidden"
              onChange={handleExtraFiles}
            />
          </label>
        </div>

        {total > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/test:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
            aria-label={`Delete test case ${index + 1}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Shared building blocks                        */
/* -------------------------------------------------------------------------- */

function FilePill({
  name,
  tone,
  onPreview,
  onRemove,
}: {
  name: string;
  tone: "warning" | "info";
  onPreview: () => void;
  onRemove: () => void;
}) {
  const palette =
    tone === "warning"
      ? "bg-warning/10 border-warning/30 text-foreground"
      : "bg-accent/10 border-accent/30 text-foreground";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-mono",
        palette,
      )}
    >
      <button
        type="button"
        onClick={onPreview}
        className="truncate max-w-32 hover:underline cursor-pointer"
      >
        {name}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="w-3.5 h-3.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex items-center justify-center"
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    </div>
  );
}

function FilePreviewDialog({
  file,
  onClose,
}: {
  file: { name: string; content: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl max-h-[80vh] overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4" /> {file?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto bg-muted text-foreground text-sm p-4 rounded-md max-h-[60vh] font-mono">
          <pre className="whitespace-pre-wrap break-words">{file?.content}</pre>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
