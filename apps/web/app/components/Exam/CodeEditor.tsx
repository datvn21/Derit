import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { registerJavaDSACompletions } from "./javaDSACompletions";
import {
  Plus,
  X,
  Play,
  RotateCcw,
  Folder,
  Terminal,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { getDefaultTemplate } from "./examUtils";
import { FileIcon } from "./FileIcon";

interface FileTab {
  name: string;
  content: string;
  language: string;
}

interface QuestionResult {
  status?: string;
  isHidden?: boolean;
}

interface CodeEditorProps {
  language: "java" | "python" | "cpp" | "javascript";
  onCodeChange?: (files: FileTab[], mainFile: string) => void;
  onRun?: () => void;
  onRunConsole?: () => void;
  consoleOutput?: {
    stdout: string;
    stderr: string;
    executionTime: number;
  } | null;
  isConsoleRunning?: boolean;

  questions?: any[];
  currentQuestionIdx?: number;
  onQuestionChange?: (idx: number) => void;
  perQResults?: Record<number, QuestionResult[]>;
  isRunning?: boolean;
  initialFiles?: FileTab[];
  initialMainFile?: string;
  templateStarterFiles?: FileTab[];
  editorStatus?: "loaded" | "unsaved" | "saving" | "saved" | "compiling";
  cooldownRemaining?: number;
}

export default function CodeEditor({
  language,
  onCodeChange,
  onRun,
  onRunConsole,
  consoleOutput,
  isConsoleRunning = false,
  questions,
  currentQuestionIdx,
  onQuestionChange,
  perQResults,
  isRunning = false,
  initialFiles = [],
  initialMainFile = "",
  templateStarterFiles,
  editorStatus,
  cooldownRemaining = 0,
}: CodeEditorProps) {
  const statusConfig: Record<
    NonNullable<typeof editorStatus>,
    { label: string; color: string; dot?: string; spin?: boolean }
  > = {
    loaded: { label: "Loaded", color: "text-sky-400", dot: "bg-sky-400" },
    unsaved: {
      label: "Unsaved",
      color: "text-orange-400",
      dot: "bg-orange-400",
    },
    saving: {
      label: "Saving…",
      color: "text-yellow-400",
      dot: "bg-yellow-400",
      spin: true,
    },
    saved: { label: "Saved", color: "text-emerald-400", dot: "bg-emerald-400" },
    compiling: {
      label: "Compiling…",
      color: "text-blue-400",
      dot: "bg-blue-400",
      spin: true,
    },
  };
  const defaultExtension = language === "java" ? ".java" : ".py";
  const defaultFileName = language === "java" ? "Main.java" : "main.py";

  const [files, setFiles] = useState<FileTab[]>(
    initialFiles.length > 0
      ? initialFiles
      : [
          {
            name: defaultFileName,
            content: getDefaultTemplate(language),
            language: language,
          },
        ],
  );
  const initialFilesList =
    initialFiles.length > 0
      ? initialFiles
      : [
          {
            name: defaultFileName,
            content: getDefaultTemplate(language),
            language: language,
          },
        ];
  const mainFileToUse = initialMainFile || defaultFileName;
  const initialActiveIndex = Math.max(
    initialFilesList.findIndex((f) => f.name === mainFileToUse),
    0,
  );
  const [activeFileIndex, setActiveFileIndex] = useState(initialActiveIndex);
  const activeFileIndexRef = useRef(initialActiveIndex);
  const [mainFile, setMainFile] = useState<string>(mainFileToUse);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [showFileTree, setShowFileTree] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(144); // px
  const consoleDragRef = useRef<boolean>(false);
  const consoleDragStartY = useRef(0);
  const consoleDragStartH = useRef(0);
  const editorRef = useRef<any>(null);

  // Keep activeFileIndexRef in sync so the functional setFiles updater
  // always targets the correct tab (avoids stale closure issues).
  useEffect(() => {
    activeFileIndexRef.current = activeFileIndex;
  }, [activeFileIndex]);

  // Keep editor focused on current tab while typing; only switch tab when
  // the user explicitly changes the selected main file.
  useEffect(() => {
    const idx = files.findIndex((f) => f.name === mainFile);
    if (idx >= 0 && idx !== activeFileIndex) {
      setActiveFileIndex(idx);
      activeFileIndexRef.current = idx;
    }
  }, [mainFile]);

  // ── Console drag-to-resize ────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!consoleDragRef.current) return;
      // dragging UPWARD (smaller clientY) grows the console
      const delta = consoleDragStartY.current - e.clientY;
      const next = consoleDragStartH.current + delta;
      setConsoleHeight(Math.min(Math.max(next, 56), 480));
    };
    const onUp = () => {
      if (consoleDragRef.current) {
        consoleDragRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleReset = () => {
    if (!confirm("Reset file này về ban đầu? Mọi thay đổi của bạn sẽ bị mất."))
      return;
    const starterSource = templateStarterFiles ?? [];
    const currentFileName = files[activeFileIndex]?.name;
    const starterFile = starterSource.find((f) => f.name === currentFileName);
    if (!starterFile) {
      // file này không có trong starter → reset về default template
      const defaultContent = getDefaultTemplate(language);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === activeFileIndex ? { ...f, content: defaultContent } : f,
        ),
      );
      return;
    }
    setFiles((prev) =>
      prev.map((f, i) =>
        i === activeFileIndex ? { ...f, content: starterFile.content } : f,
      ),
    );
  };

  // Skip the first mount — the parent already holds the correct initialFiles
  // from server data. Firing on mount would spuriously mark the question dirty
  // and trigger an immediate autosave.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (onCodeChange) {
      onCodeChange(files, mainFile);
    }
  }, [files, mainFile]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      // Use ref so the updater always targets the correct tab even if
      // activeFileIndex state hasn't flushed yet.
      const idx = activeFileIndexRef.current;
      setFiles((prev) =>
        prev.map((f, i) =>
          i === idx ? { ...f, content: value } : f,
        ),
      );
    }
  };

  const addNewFile = () => {
    if (!newFileName.trim()) return;

    let fileName = newFileName.trim();
    if (!fileName.endsWith(defaultExtension)) {
      fileName += defaultExtension;
    }

    // Check duplicate
    if (files.some((f) => f.name === fileName)) {
      alert("File with this name already exists!");
      return;
    }

    const newFile: FileTab = {
      name: fileName,
      content:
        language === "java"
          ? `public class ${fileName.replace(".java", "")} {\n    // Write your code here\n}\n`
          : "# Write your code here\n",
      language: language,
    };

    setFiles([...files, newFile]);
    setActiveFileIndex(files.length);
    setNewFileName("");
    setShowNewFileInput(false);
  };

  // Names of starter files – these must never be deleted
  const starterFileNames = new Set(
    (templateStarterFiles ?? []).map((f) => f.name),
  );

  const removeFile = (index: number) => {
    if (files.length === 1) {
      alert("Cannot delete the last file!");
      return;
    }

    const fileToRemove = files[index];
    if (starterFileNames.has(fileToRemove.name)) {
      alert("Không thể xoá file starter!");
      return;
    }
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);

    // If removed file was main file, set new main file
    if (fileToRemove.name === mainFile && newFiles.length > 0) {
      setMainFile(newFiles[0].name);
    }

    // Adjust active index
    if (activeFileIndex >= newFiles.length) {
      setActiveFileIndex(newFiles.length - 1);
    } else if (activeFileIndex === index && index > 0) {
      setActiveFileIndex(index - 1);
    }
  };

  const onRunRef = useRef<(() => void) | undefined>(undefined);
  onRunRef.current = onRunConsole ?? onRun;

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    // Ctrl+Enter → run inside Monaco (Monaco captures this key before document)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!isRunning && !isConsoleRunning) onRunRef.current?.();
    });
    // Register Java DSA snippets (no-op for non-Java editors)
    if (language === "java") {
      registerJavaDSACompletions(monaco);
    }
  };

  const showQuestionTabs =
    questions && questions.length > 1 && onQuestionChange != null;
  const activeFileName = files[activeFileIndex]?.name || defaultFileName;
  const activeQuestionNumber =
    questions?.[currentQuestionIdx ?? 0]?.questionNumber ?? "single";
  // Give each question/file pair its own Monaco model so undo/redo stacks do not bleed across tabs.
  const editorModelPath = `question-${activeQuestionNumber}/${activeFileName}`;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1e1e2e]">
      {/* Question Tabs */}
      {showQuestionTabs && (
        <div className="flex items-end gap-0.5 px-2 bg-[#252526] border-b border-[#3c3c3c] h-10 shrink-0">
          {questions!.map((q, idx) => {
            const qResults = perQResults?.[q.questionNumber];
            const total = qResults?.filter((tc) => !tc.isHidden).length ?? 0;
            const passed =
              qResults?.filter((tc) => tc.status === "passed").length ?? 0;
            const hasResult = total > 0;
            const allPassed = hasResult && passed === total;
            const active = idx === currentQuestionIdx;
            return (
              <button
                key={q.questionNumber}
                onClick={() => onQuestionChange!(idx)}
                className={`flex items-center gap-2 px-3 h-8 text-sm font-medium rounded-t transition-colors border border-b-0 cursor-pointer ${
                  active
                    ? "bg-[#2d2d2d] border-[#3c3c3c] text-white"
                    : "bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]"
                }`}
              >
                Question {q.questionNumber}
                {hasResult && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      allPassed
                        ? "bg-emerald-900/60 text-emerald-400"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {passed}/{total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar - File Tree */}
        <div className="w-48 border-r border-[#3c3c3c] bg-[#252526] flex flex-col">
          {/* File Tree Header */}
          <div className="px-3 h-10 shrink-0 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm font-medium text-gray-300">
              <span>Files</span>
            </div>
            <button
              onClick={() => setShowNewFileInput(!showNewFileInput)}
              className="hover:bg-[#3c3c3c] text-gray-400 rounded p-1 cursor-pointer"
              title="New File"
              aria-label="New File"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* File List */}
          {showFileTree && (
            <div className="flex-1 overflow-y-auto">
              {showNewFileInput && (
                <div className="px-2  flex gap-1 items-center text-white py-2 border-b border-[#3c3c3c]">
                  <Input
                    autoFocus
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addNewFile();
                      if (e.key === "Escape") {
                        setShowNewFileInput(false);
                        setNewFileName("");
                      }
                    }}
                    placeholder={`FILENAME`}
                    className="h-7 text-xs "
                  />
                  <span className="font-semibold text-xs ">
                    {defaultExtension}
                  </span>
                </div>
              )}
              {files.map((file, index) => (
                <div
                  key={index}
                  className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-[#2a2a2a] ${
                    activeFileIndex === index
                      ? "bg-[#37373d] text-white"
                      : "text-gray-400"
                  }`}
                  onClick={() => setActiveFileIndex(index)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileIcon name={file.name} className="w-4 h-4 shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                    {mainFile === file.name && (
                      <span className="text-xs bg-blue-900/60 text-blue-300 px-1 py-0.5 rounded shrink-0">
                        main
                      </span>
                    )}
                  </div>
                  {files.length > 1 && !starterFileNames.has(file.name) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 text-gray-500 cursor-pointer"
                      title={`Delete ${file.name}`}
                      aria-label={`Delete ${file.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Main File Selector */}
          <div className="px-3 py-2 bg-[#2d2d2d] border-t border-[#3c3c3c]">
            <label className="text-xs text-gray-400 block mb-1">
              Main file
            </label>
            <select
              value={mainFile}
              onChange={(e) => setMainFile(e.target.value)}
              className="w-full border border-[#555] rounded px-2 py-1 text-xs bg-[#3c3c3c] text-gray-200 cursor-pointer"
            >
              {files.map((file) => (
                <option key={file.name} value={file.name}>
                  {file.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Editor Header */}
          <div className="px-4 h-10 shrink-0 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <FileIcon
                name={files[activeFileIndex]?.name || ""}
                className="w-4 h-4"
              />
              <span className="font-medium">
                {files[activeFileIndex]?.name || ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {editorStatus &&
                (() => {
                  const cfg = statusConfig[editorStatus];
                  return (
                    <div
                      className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} ${
                          cfg.spin ? "animate-pulse" : ""
                        }`}
                      />
                      {cfg.label}
                    </div>
                  );
                })()}
              <Button
                onClick={handleReset}
                size="sm"
                variant="ghost"
                title="Reset về file gốc"
                className="text-gray-400 hover:bg-gray-600 hover:text-white h-7 px-2 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <Button
                onClick={onRunConsole ?? onRun}
                disabled={
                  isRunning || isConsoleRunning || cooldownRemaining > 0
                }
                size="sm"
                className="bg-primary rounded-sm hover:bg-primary/80 text-white h-7 gap-1 cursor-pointer disabled:opacity-60 tabular-nums"
              >
                <Play className="size-3 mr-1 fill-white" />
                {isConsoleRunning || isRunning
                  ? "Running"
                  : cooldownRemaining > 0
                    ? `Wait ${cooldownRemaining}s`
                    : "Run"}
              </Button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <Editor
              height="100%"
              width="100%"
              path={editorModelPath}
              language={language}
              value={files[activeFileIndex]?.content || ""}
              onChange={handleEditorChange}
              onMount={(editor, monaco) => handleEditorDidMount(editor, monaco)}
              theme="vs-dark"
              options={{
                stickyScroll: { enabled: false },
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: "on",
                wordWrapColumn: 120,
                wrappingStrategy: "advanced",
                scrollbar: {
                  horizontal: "hidden",
                  alwaysConsumeMouseWheel: false,
                },
              }}
            />
          </div>

          {/* Console Panel */}
          <div
            style={{ height: showConsole ? consoleHeight : 28 }}
            className=" shrink-0 flex flex-col"
          >
            {/* Drag handle – only visible when console is open */}
            {showConsole && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  consoleDragRef.current = true;
                  consoleDragStartY.current = e.clientY;
                  consoleDragStartH.current = consoleHeight;
                  document.body.style.cursor = "row-resize";
                  document.body.style.userSelect = "none";
                }}
                className="h-1 shrink-0 bg-[#252526] hover:bg-blue-500/50 cursor-row-resize transition-colors"
              />
            )}
            {/* Console toggle header */}
            <div
              className="flex items-center justify-between px-3 h-7 bg-[#252526] cursor-pointer select-none shrink-0"
              onClick={() => setShowConsole((v) => !v)}
            >
              <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                Console
                {isConsoleRunning && (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-1" />
                )}
              </span>
              <div className="flex items-center gap-2">
                {consoleOutput && !isConsoleRunning && (
                  <span className="text-xs text-yellow-500">
                    {consoleOutput.executionTime}ms
                  </span>
                )}
                {showConsole ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronUp className="w-3 h-3 text-gray-500" />
                )}
              </div>
            </div>

            {/* Console output area */}
            {showConsole && (
              <div className="flex-1 overflow-y-auto p-2 font-mono text-sm">
                {isConsoleRunning ? (
                  <span className="text-gray-500">Running…</span>
                ) : consoleOutput ? (
                  <>
                    {consoleOutput.stdout && (
                      <pre className="text-gray-300 whitespace-pre-wrap">
                        {consoleOutput.stdout}
                      </pre>
                    )}
                    {consoleOutput.stderr && (
                      <pre className="text-red-400 whitespace-pre-wrap mt-1">
                        {consoleOutput.stderr}
                      </pre>
                    )}
                    {!consoleOutput.stdout && !consoleOutput.stderr && (
                      <span className="text-gray-600">(no output)</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-600">
                    Press Run to execute your code…
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
