/**
 * `QuestionsEditor` — renders the per-question accordion list for the
 * currently active exam code. Used inside `StepCodesAndQuestions`.
 *
 * Layout rules (paired with StepCodesAndQuestions.tsx):
 *  - One row per logical group. No `bg-border w-px` separators.
 *  - Status (ready / incomplete) renders via `<Badge>` variants only.
 *  - Starter-file row mirrors StepCodesAndQuestions' PDF row: filename
 *    chip + action buttons, no inline `flex-wrap` soup.
 *  - Test cases: input and expected output stacked, one per row,
 *    with the action bar in a dedicated row below.
 */
import { useEffect, useState, type ChangeEvent } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
} from "lucide-react";
import type { UseTemplateStateResult } from "./useTemplateState";
import {
  STARTER_FILE_ACCEPT,
  TEST_FILE_ACCEPT,
  EXTRA_FILE_ACCEPT,
  type StarterFile,
} from "./types";
import { cn } from "~/lib/utils";
import { FileIcon } from "~/components/ui/file-icon";
import Editor from "@monaco-editor/react";

export function QuestionsEditor({
  state,
  activeCodeIndex,
  jumpTarget,
}: {
  state: UseTemplateStateResult;
  activeCodeIndex: number;
  jumpTarget?: string;
}) {
  const { examCodes } = state;
  const code = examCodes[activeCodeIndex];
  if (!code) return null;

  // Track open state of questions for this code: default question 0 is open
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({ 0: true });

  const handleAddQuestion = () => {
    const newIndex = code.questions.length;
    state.addQuestion(activeCodeIndex);
    // Collapse all previous questions and expand only the new question
    setOpenMap({ [newIndex]: true });
    requestAnimationFrame(() => {
      const el = document.getElementById(
        `wizard-code-${activeCodeIndex}-question-${newIndex}`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const handleToggle = (qi: number) => {
    setOpenMap((prev) => ({
      ...prev,
      [qi]: !prev[qi],
    }));
  };

  const handleOpen = (qi: number) => {
    setOpenMap((prev) => ({
      ...prev,
      [qi]: true,
    }));
  };

  useEffect(() => {
    if (!jumpTarget) return;
    const match = jumpTarget.match(/question-(\d+)/);
    if (match && match[1] !== undefined) {
      const targetQi = parseInt(match[1], 10);
      setOpenMap((prev) => ({ ...prev, [targetQi]: true }));
    }
  }, [jumpTarget]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-foreground">Questions</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddQuestion}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add question
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {code.questions.map((q, qi) => (
          <QuestionAccordion
            key={qi}
            index={qi + 1}
            codeIndex={activeCodeIndex}
            question={q}
            open={!!openMap[qi]}
            onToggle={() => handleToggle(qi)}
            onOpen={() => handleOpen(qi)}
            jumpTarget={jumpTarget}
            onTitleChange={(v) =>
              state.updateQuestion(activeCodeIndex, qi, "title", v)
            }
            onRemove={() => {
              if (
                window.confirm(
                  `Delete Q${q.questionNumber} from code ${code.codeNumber || activeCodeIndex + 1}?`,
                )
              ) {
                state.removeQuestion(activeCodeIndex, qi);
              }
            }}
            {...questionSlotProps(state, activeCodeIndex, qi)}
          />
        ))}
      </div>
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
  codeIndex,
  question,
  open,
  onToggle,
  onOpen,
  jumpTarget,
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
  codeIndex: number;
  question: import("./types").Question;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
  jumpTarget?: string;
  onTitleChange: (v: string) => void;
  onRemove: () => void;
} & SlotHandlers) {
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    content: string;
  } | null>(null);

  const titleMissing = !question.title.trim();
  const testCaseIssues = question.testCases.filter(
    (tc) => !tc.expectedOutput.trim(),
  ).length;
  const hasFileInputs = question.starterFiles.some((f) => f.canDownload);

  const ready = !titleMissing && testCaseIssues === 0;
  const questionId = `wizard-code-${codeIndex}-question-${index - 1}`;

  useEffect(() => {
    if (!jumpTarget?.startsWith(questionId)) return;
    onOpen();
    requestAnimationFrame(() => {
      document
        .getElementById(jumpTarget)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [jumpTarget, questionId, onOpen]);

  return (
    <article
      id={questionId}
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
        onClick={() => !open && onOpen()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={open}
          aria-label={open ? "Collapse question" : "Expand question"}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
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

        {/* Compact status row — only when collapsed */}
        {!open && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              {question.testCases.length} TC · {question.starterFiles.length}{" "}
              files
              {hasFileInputs ? " · downloadable" : ""}
            </span>
            {ready ? (
              <Badge variant="success" className="text-[10px]">
                Ready
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px]">
                <AlertTriangle className="w-3 h-3" /> Incomplete
              </Badge>
            )}
          </div>
        )}

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
      </header>

      {open && (
        <div className="border-t border-border px-4 py-5 flex flex-col gap-6 bg-background">
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

          <TestCasesSection
            codeIndex={codeIndex}
            questionIndex={index - 1}
            testCases={question.testCases}
            onAdd={onAddTestCase}
            onRemove={onRemoveTestCase}
            onUpdate={onUpdateTestCase}
            onPreviewFile={(f) =>
              setPreviewFile({ name: f.name, content: f.content })
            }
          />
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Code2 className="w-4 h-4 text-muted-foreground" />
          Starter files
          {files.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal tabular-nums">
              ({files.length})
            </span>
          )}
        </Label>
        <FileUploadLabel
          multiple
          accept={STARTER_FILE_ACCEPT}
          onFiles={handleFiles}
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
          {files.length === 0 ? "Add files" : "Add more"}
        </FileUploadLabel>
      </div>

      {files.length === 0 ? (
        <FileUploadLabel
          multiple
          accept={STARTER_FILE_ACCEPT}
          onFiles={handleFiles}
          variant="dropzone"
        >
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-foreground">
            Drop or click to upload starter files
          </span>
          <span className="text-xs text-muted-foreground">
            .java · .cpp · .py · .js · .txt · …
          </span>
        </FileUploadLabel>
      ) : (
        <ul className="rounded-md border border-border divide-y divide-border bg-card overflow-hidden">
          {files.map((sf, i) => {
            const isMain = defaultMainFile === sf.name;
            const entryDisabled = Boolean(defaultMainFile) && !isMain;
            return (
              <li
                key={`${sf.name}-${i}`}
                className={cn(
                  "group flex items-center gap-3 px-4 py-2 transition-colors",
                  isMain ? "bg-warning/5" : "hover:bg-muted/40",
                )}
              >
                <FileIcon
                  name={sf.name}
                  className="w-4 h-4 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => onPreview(sf)}
                  className="min-w-0 flex-1 cursor-pointer truncate rounded text-left font-sans text-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={sf.name}
                >
                  {sf.name}
                </button>

                {isMain && (
                  <Badge variant="warning" className="text-[10px]">
                    Entry
                  </Badge>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant={isMain ? "default" : "outline"}
                    size="sm"
                    disabled={entryDisabled}
                    onClick={() => onSetDefault(sf.name)}
                    title={
                      isMain
                        ? "Default entry file (click to unset)"
                        : entryDisabled
                          ? `Only one entry file is allowed (${defaultMainFile})`
                          : "Set as default entry file"
                    }
                    aria-pressed={isMain}
                    className="h-7 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Star
                      className="w-3 h-3 mr-1"
                      fill={isMain ? "currentColor" : "none"}
                    />
                    Entry
                  </Button>
                  <Button
                    type="button"
                    variant={sf.canDownload ? "default" : "outline"}
                    size="sm"
                    onClick={() => onToggleDownload(i)}
                    title={
                      sf.canDownload
                        ? "Students can download (click to forbid)"
                        : "Click to allow students to download"
                    }
                    aria-pressed={sf.canDownload}
                    className={cn(
                      "h-7 px-2 text-xs",
                      !sf.canDownload &&
                        "border-border/60 bg-muted/40 text-muted-foreground opacity-70 hover:bg-muted hover:text-foreground hover:opacity-100",
                    )}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {sf.canDownload ? "Downloadable" : "Hidden"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(i)}
                    aria-label={`Remove ${sf.name}`}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
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
/*                              Test cases section                            */
/* -------------------------------------------------------------------------- */

function TestCasesSection({
  codeIndex,
  questionIndex,
  testCases,
  onAdd,
  onRemove,
  onUpdate,
  onPreviewFile,
}: {
  codeIndex: number;
  questionIndex: number;
  testCases: import("./types").TestCase[];
  onAdd: () => void;
  onRemove: (ti: number) => void;
  onUpdate: <
    K extends
      "input" | "expectedOutput" | "isHidden" | "testFile" | "extraFiles",
  >(
    ti: number,
    field: K,
    value: any,
  ) => void;
  onPreviewFile: (f: { name: string; content: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Test cases</Label>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add test case
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {testCases.map((tc, ti) => (
          <TestCaseCard
            key={ti}
            index={ti}
            codeIndex={codeIndex}
            questionIndex={questionIndex}
            testCase={tc}
            total={testCases.length}
            onRemove={() => onRemove(ti)}
            onUpdate={(field, value) => onUpdate(ti, field, value)}
            onPreviewFile={onPreviewFile}
          />
        ))}
      </div>
    </div>
  );
}

function TestCaseCard({
  index,
  codeIndex,
  questionIndex,
  testCase,
  total,
  onRemove,
  onUpdate,
  onPreviewFile,
}: {
  index: number;
  codeIndex: number;
  questionIndex: number;
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
  const testFileMissing = !testCase.testFile;
  const missingRequired = outputMissing || testFileMissing;

  return (
    <div
      id={`wizard-code-${codeIndex}-question-${questionIndex}-testcase-${index}`}
      className={cn(
        "rounded-md border bg-card p-4 flex flex-col gap-4",
        missingRequired ? "border-warning/60" : "border-border",
      )}
    >
      {/* Header: index + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground font-mono text-xs font-semibold shrink-0 tabular-nums">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-foreground">
            Test case {index + 1}
          </span>
          {missingRequired && (
            <Badge variant="warning" className="text-[10px]">
              <AlertTriangle className="w-3 h-3" /> Missing required
            </Badge>
          )}
          {testCase.isHidden && (
            <Badge variant="info" className="text-[10px]">
              Hidden
            </Badge>
          )}
        </div>
        {total > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            aria-label={`Delete test case ${index + 1}`}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
          </Button>
        )}
      </div>

      {/* Inputs (Dark Code Blocks) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Input Block */}
        <div className="flex flex-col rounded-md border border-[#333] bg-[#1e1e1e] overflow-hidden focus-within:border-primary/60 transition-colors">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#262626] border-b border-[#333] select-none text-xs">
            <span className="font-medium text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              Input
            </span>
          </div>
          <textarea
            value={testCase.input}
            onChange={(e) => onUpdate("input", e.target.value)}
            placeholder="e.g. 5"
            spellCheck={false}
            className="w-full bg-[#1e1e1e] text-zinc-100 placeholder:text-zinc-500 font-mono text-xs p-3 leading-relaxed resize-y min-h-[76px] outline-none border-0 focus:ring-0"
            rows={3}
          />
        </div>

        {/* Expected Output Block */}
        <div
          className={cn(
            "flex flex-col rounded-md border border-[#333] bg-[#1e1e1e] overflow-hidden focus-within:border-primary/60 transition-colors",
            outputMissing && "border-warning/80 focus-within:border-warning",
          )}
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#262626] border-b border-[#333] select-none text-xs">
            <span className="font-medium text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              Expected output
              <RequiredMark />
            </span>
            {outputMissing && (
              <span className="text-[11px] text-warning font-medium">
                Required
              </span>
            )}
          </div>
          <textarea
            value={testCase.expectedOutput}
            onChange={(e) => onUpdate("expectedOutput", e.target.value)}
            placeholder="e.g. 120"
            spellCheck={false}
            className="w-full bg-[#1e1e1e] text-zinc-100 placeholder:text-zinc-500 font-mono text-xs p-3 leading-relaxed resize-y min-h-[76px] outline-none border-0 focus:ring-0"
            rows={3}
          />
        </div>
      </div>

      {/* Files row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FileSlot
          label="Test file"
          required
          tone="warning"
          file={testCase.testFile}
          accept={TEST_FILE_ACCEPT}
          placeholder={`Test${index + 1}.java`}
          missing={testFileMissing}
          onChange={(file) =>
            onUpdate("testFile", { name: file.name, content: file.content })
          }
          onClear={() => onUpdate("testFile", undefined)}
          onPreview={() => onPreviewFile(testCase.testFile!)}
        />
        <FileSlot
          label="Extra files"
          tone="info"
          multiple
          files={testCase.extraFiles ?? []}
          accept={EXTRA_FILE_ACCEPT}
          placeholder="Attach input fixtures or data files"
          onAdd={(file) =>
            onUpdate("extraFiles", [
              ...(
                (testCase.extraFiles ?? []) as {
                  name: string;
                  content: string;
                }[]
              ).filter((f) => f.name !== file.name),
              { name: file.name, content: file.content },
            ])
          }
          onRemove={(name) =>
            onUpdate(
              "extraFiles",
              (
                (testCase.extraFiles ?? []) as {
                  name: string;
                  content: string;
                }[]
              ).filter((f) => f.name !== name),
            )
          }
          onPreview={(f) => onPreviewFile(f)}
        />
      </div>

      {/* Hidden toggle as its own row */}
      <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground transition-colors">
        <input
          type="checkbox"
          checked={testCase.isHidden}
          onChange={(e) => onUpdate("isHidden", e.target.checked)}
          className="rounded border-input text-primary focus:ring-ring w-4 h-4"
        />
        Hidden test case
      </label>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Required marker                                */
/* -------------------------------------------------------------------------- */

function RequiredMark() {
  return (
    <span
      aria-label="required"
      className="text-destructive ml-0.5 font-semibold"
    >
      *
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                              File slots                                    */
/* -------------------------------------------------------------------------- */

function FileSlot({
  label,
  tone,
  file,
  files,
  multiple,
  accept,
  placeholder,
  required,
  missing,
  onChange,
  onAdd,
  onClear,
  onRemove,
  onPreview,
}: {
  label: string;
  tone: "warning" | "info";
  file?: { name: string; content: string };
  files?: { name: string; content: string }[];
  multiple?: boolean;
  accept: string;
  placeholder: string;
  required?: boolean;
  missing?: boolean;
  onChange?: (file: { name: string; content: string }) => void;
  onAdd?: (file: { name: string; content: string }) => void;
  onClear?: () => void;
  onRemove?: (name: string) => void;
  onPreview: (f: { name: string; content: string }) => void;
}) {
  const singleFile = file;
  const manyFiles = files ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 h-5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          {label}
          {required && <RequiredMark />}
        </Label>
        {singleFile && (
          <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">
            Attached
          </Badge>
        )}
        {manyFiles.length > 0 && (
          <Badge variant="primary" className="text-[10px] px-1.5 py-0 h-4">
            {manyFiles.length} attached
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 min-h-[36px]">
        {singleFile ? (
          <FileChip
            name={singleFile.name}
            tone={tone}
            onPreview={() => onPreview(singleFile)}
            onRemove={onClear}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <FileUploadLabel
              multiple={multiple}
              accept={accept}
              onFiles={(list) => {
                if (!list) return;
                const files = Array.from(list);
                if (multiple) {
                  files.forEach((file) => {
                    const reader = new FileReader();
                    reader.onload = (e) =>
                      onAdd?.({
                        name: file.name,
                        content: (e.target?.result as string) ?? "",
                      });
                    reader.readAsText(file);
                  });
                } else {
                  const file = files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (e) =>
                    onChange?.({
                      name: file.name,
                      content: (e.target?.result as string) ?? "",
                    });
                  reader.readAsText(file);
                }
              }}
              variant={missing ? "required" : "inline"}
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {placeholder}
            </FileUploadLabel>
            {required && missing && (
              <p className="text-xs text-warning">
                Required — upload the test file for this test case.
              </p>
            )}
          </div>
        )}

        {manyFiles.map((f) => (
          <FileChip
            key={f.name}
            name={f.name}
            tone={tone}
            onPreview={() => onPreview(f)}
            onRemove={() => onRemove?.(f.name)}
          />
        ))}
      </div>
    </div>
  );
}

function FileUploadLabel({
  multiple,
  accept,
  onFiles,
  variant = "inline",
  children,
}: {
  multiple?: boolean;
  accept: string;
  onFiles: (list: FileList | null) => void;
  variant?: "inline" | "dropzone" | "required";
  children: React.ReactNode;
}) {
  const isDropzone = variant === "dropzone";
  const isRequired = variant === "required";
  return (
    <label
      className={cn(
        isDropzone
          ? "flex flex-col items-center justify-center gap-2 px-4 py-6 border border-dashed border-border rounded-md cursor-pointer bg-muted hover:bg-muted/50 hover:border-primary/50 transition-colors text-center"
          : isRequired
            ? "h-9 inline-flex items-center gap-1.5 px-3 border border-dashed border-warning rounded-md text-xs text-warning cursor-pointer hover:bg-warning/10 hover:border-warning transition-colors self-start"
            : "h-9 inline-flex items-center gap-1.5 px-3 border border-dashed border-border rounded-md text-xs text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors self-start",
      )}
    >
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function FileChip({
  name,
  tone,
  onPreview,
  onRemove,
}: {
  name: string;
  tone: "warning" | "info";
  onPreview: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "h-9 inline-flex items-center gap-2 rounded-md border px-3 text-xs font-sans self-start max-w-full",
        tone === "warning"
          ? "bg-warning/5 border-warning/30"
          : "bg-muted/50 border-border",
      )}
    >
      <FileIcon
        name={name}
        className="w-4 h-4 shrink-0"
      />
      <button
        type="button"
        onClick={onPreview}
        className="truncate hover:underline cursor-pointer text-foreground font-medium"
      >
        {name}
      </button>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="h-6 w-6 p-0 ml-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              File preview dialog                            */
/* -------------------------------------------------------------------------- */

function getMonacoLanguage(filename?: string): string {
  if (!filename) return "plaintext";
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "java":
      return "java";
    case "py":
    case "python":
      return "python";
    case "cpp":
    case "cc":
    case "cxx":
    case "c":
    case "h":
    case "hpp":
      return "cpp";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sql":
      return "sql";
    case "sh":
    case "bash":
      return "shell";
    default:
      return "plaintext";
  }
}

function FilePreviewDialog({
  file,
  onClose,
}: {
  file: { name: string; content: string } | null;
  onClose: () => void;
}) {
  const language = file?.name ? getMonacoLanguage(file.name) : "plaintext";

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-4xl w-[92vw] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="px-5 py-3.5 border-b border-border bg-card">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileIcon name={file?.name || ""} className="w-4 h-4 shrink-0" />
            <span>{file?.name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-background overflow-hidden">
          <Editor
            height="100%"
            language={language}
            value={file?.content ?? ""}
            theme="vs"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "off",
              automaticLayout: true,
              renderLineHighlight: "all",
              domReadOnly: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
