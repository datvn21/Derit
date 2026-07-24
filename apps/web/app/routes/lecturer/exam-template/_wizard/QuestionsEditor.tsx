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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-foreground">Questions</h3>
          <p className="text-xs text-muted-foreground">
            {total} question{total === 1 ? "" : "s"} in this code
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => state.addQuestion(activeCodeIndex)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add question
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {code.questions.map((q, qi) => (
          <QuestionAccordion
            key={qi}
            index={qi + 1}
            question={q}
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

  const ready = !titleMissing && testCaseIssues === 0;

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
            const ext = sf.name.split(".").pop()?.toLowerCase() ?? "";
            return (
              <li
                key={`${sf.name}-${i}`}
                className={cn(
                  "group flex items-center gap-3 px-4 py-2 transition-colors",
                  isMain ? "bg-warning/5" : "hover:bg-muted/40",
                )}
              >
                <FileText
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isMain ? "text-warning" : "text-primary",
                  )}
                />
                <button
                  type="button"
                  onClick={() => onPreview(sf)}
                  className="truncate font-mono text-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer flex-1 min-w-0 text-left"
                  title={sf.name}
                >
                  {sf.name}
                </button>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono shrink-0">
                  {ext}
                </span>

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
                    onClick={() => onSetDefault(sf.name)}
                    title={
                      isMain
                        ? "Default entry file (click to unset)"
                        : "Set as default entry file"
                    }
                    aria-pressed={isMain}
                    className="h-7 px-2 text-xs"
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
                    className="h-7 px-2 text-xs"
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
  testCases,
  onAdd,
  onRemove,
  onUpdate,
  onPreviewFile,
}: {
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
  const testFileMissing = !testCase.testFile;
  const missingRequired = outputMissing || testFileMissing;

  return (
    <div
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

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Input</Label>
          <Textarea
            value={testCase.input}
            onChange={(e) => onUpdate("input", e.target.value)}
            placeholder="e.g. 5"
            spellCheck={false}
            className="font-mono text-xs leading-snug resize-y min-h-20"
            rows={3}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            Expected output
            <RequiredMark />
          </Label>
          <Textarea
            value={testCase.expectedOutput}
            onChange={(e) => onUpdate("expectedOutput", e.target.value)}
            placeholder="e.g. 120"
            spellCheck={false}
            className={cn(
              "font-mono text-xs leading-snug resize-y min-h-20",
              outputMissing && "border-warning focus-visible:ring-warning",
            )}
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
      <Label className="text-xs text-muted-foreground flex items-center gap-2">
        {label}
        {required && <RequiredMark />}
        {singleFile && (
          <Badge variant="warning" className="text-[10px]">
            Attached
          </Badge>
        )}
        {manyFiles.length > 0 && (
          <Badge variant="info" className="text-[10px]">
            {manyFiles.length} attached
          </Badge>
        )}
      </Label>

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
            <p className="text-xs text-warning">Required — upload the test file for this test case.</p>
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
            ? "inline-flex items-center px-3 py-1.5 border border-dashed border-warning rounded-md text-xs text-warning cursor-pointer hover:bg-warning/10 hover:border-warning transition-colors self-start"
            : "inline-flex items-center px-3 py-1.5 border border-dashed border-border rounded-md text-xs text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors self-start",
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
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-mono self-start max-w-full",
        tone === "warning"
          ? "bg-warning/5 border-warning/30"
          : "bg-accent border-accent-foreground/20",
      )}
    >
      <FileText
        className={cn(
          "w-3.5 h-3.5 shrink-0",
          tone === "warning" ? "text-warning" : "text-primary",
        )}
      />
      <button
        type="button"
        onClick={onPreview}
        className="truncate hover:underline cursor-pointer text-foreground"
      >
        {name}
      </button>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              File preview dialog                            */
/* -------------------------------------------------------------------------- */

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
            <Button variant="default">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
