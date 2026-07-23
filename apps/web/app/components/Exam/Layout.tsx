import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import ExamHeader from "./Header";
import CodeEditor from "./CodeEditor";
import TestCases from "./TestCases";
import type { TestCase } from "./TestCases";
import PDFViewer from "~/components/Exam/PDFViewer";
import { GripVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { authAPI, examSessionAPI, submissionAPI, BACKEND_URL } from "~/lib/api";
import { useUserStore } from "~/stores/userStore";
import { toast } from "sonner";

interface FileTab {
  name: string;
  content: string;
  language: string;
}

interface Question {
  questionNumber: number;
  title: string;
  testCases: Array<{
    input: string;
    expectedOutput: string;
    isHidden: boolean;
    hasTestFile?: boolean;
  }>;
  starterFiles?: Array<{ name: string; content: string }>;
  defaultMainFile?: string;
}

function getDefaultTemplate(language: string): string {
  if (language === "java") {
    return `public class Main {
    public static void main(String[] args) {
        // Write your code here
    }
}`;
  }
  return `# Write your code here\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n`;
}

function buildDefaultFiles(language: string): FileTab[] {
  const name = language === "java" ? "Main.java" : "main.py";
  return [{ name, content: getDefaultTemplate(language), language }];
}

/**
 * Best-effort fire-and-forget autosave using fetch with keepalive.
 * Safe to call from beforeunload / component-unmount cleanup because:
 *  - keepalive: true  → request outlives the page
 *  - credentials: 'include' → session cookie sent even cross-origin
 *  - no await / no React state → safe after component unmount
 */
function beaconAutosave(
  sid: string,
  qn: number,
  files: FileTab[],
  main: string,
  lang: string,
) {
  const body = JSON.stringify({
    examSessionId: sid,
    questionNumber: qn,
    code:
      files.find((f) => f.name === main)?.content ?? files[0]?.content ?? "",
    language: lang,
    files: files.map((f) => ({ name: f.name, content: f.content })),
    mainFile: main,
  });
  fetch(`${BACKEND_URL}/submissions/autosave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body,
  }).catch(() => {
    /* best-effort */
  });
}

/** Map a question's testCases + saved testResults into the TestCase display format */
function mergeResults(
  questionTestCases: Question["testCases"],
  testResults: any[] = [],
): TestCase[] {
  return questionTestCases.map((tc, idx) => {
    const r = testResults[idx];
    return {
      id: idx + 1,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden,
      hasTestFile: tc.hasTestFile,
      status: r
        ? (r.status as "passed" | "failed" | "error")
        : ("pending" as const),
      actualOutput: r?.actualOutput ?? undefined,
      errorMessage: r?.errorMessage ?? undefined,
      executionTime: r?.executionTime ?? undefined,
    };
  });
}

export default function Layout() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  useEffect(() => {
    if (!user) {
      authAPI
        .getUser()
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          navigate("/");
        });
    }
  }, [navigate, setUser, user]);

  // ── Auto-fullscreen (production only) ────────────────────────────────────
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    return;
  }, []);

  // ── Activity Tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !user) return;

    // Fire-and-forget helper — uses keepalive so it survives rapid interactions
    const logEvent = (type: string) => {
      // Standard join/tab_switch go through existing recordActivity endpoint
      if (type === "join" || type === "tab_switch") {
        submissionAPI.recordActivity(sessionId, { type: type as "join" | "tab_switch" }).catch(() => {});
        return;
      }
      // Other cheating-indicator events — sent to new client-event endpoint
      fetch(`${BACKEND_URL}/submissions/record-client-event/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({ type }),
      }).catch(() => {});
    };

    // Record join once on mount
    logEvent("join");

    // Tab switch (document hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") logEvent("tab_switch");
    };

    // Copy attempt inside exam window
    const handleCopy = () => logEvent("copy_attempt");

    // Paste attempt inside exam window
    const handlePaste = () => logEvent("paste_attempt");

    // Fullscreen exit (production only)
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && import.meta.env.PROD) {
        logEvent("fullscreen_exit");
      }
    };

    // Right-click suppression + tracking
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logEvent("right_click");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [sessionId, user]);

  // ── Remote data ─────────────────────────────────────────────────────────
  const {
    data: examData,
    isLoading: examLoading,
    error: examError,
  } = useQuery({
    queryKey: ["exam", sessionId],
    queryFn: () => examSessionAPI.getExam(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
    staleTime: 0,
    retry: 1,
  });

  const { data: savedSubmissionData, isLoading: submissionLoading } = useQuery({
    queryKey: ["submission", sessionId],
    queryFn: () =>
      submissionAPI
        .getByExam(sessionId!)
        .then((r) => r.data?.submission ?? null),
    enabled: !!sessionId,
    staleTime: 0,
  });

  // ── Per-question editor state ────────────────────────────────────────────
  // keyed by questionNumber
  const [perQFiles, setPerQFiles] = useState<Record<number, FileTab[]>>({});
  const [perQMain, setPerQMain] = useState<Record<number, string>>({});
  const [perQResults, setPerQResults] = useState<Record<number, TestCase[]>>(
    {},
  );

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const currentQNRef = useRef<number | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false); // full-run (all TCs)
  const [runningTestCaseIdx, setRunningTestCaseIdx] = useState<number | null>(
    null,
  ); // E: per-TC spinner
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [testCaseHeight, setTestCaseHeight] = useState(256);
  const [isVerticalDragging, setIsVerticalDragging] = useState(false);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // keep stable ref for polling cleanup
  const pollAbort = useRef<boolean>(false);

  // console run state
  const [consoleOutput, setConsoleOutput] = useState<{
    stdout: string;
    stderr: string;
    executionTime: number;
  } | null>(null);
  const [isConsoleRunning, setIsConsoleRunning] = useState(false);

  // ── D: Separate cooldowns — console/full-run (5 s) vs per-testcase (2 s) ─────
  // Shorter testcase cooldown lets students cycle through TCs quickly.
  const CONSOLE_COOLDOWN_SECS = 5;
  const TC_COOLDOWN_SECS = 2;

  const [consoleCooldown, setConsoleCooldown] = useState(0);
  const consoleCooldownRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const startConsoleCooldown = useCallback(() => {
    if (consoleCooldownRef.current) clearInterval(consoleCooldownRef.current);
    setConsoleCooldown(CONSOLE_COOLDOWN_SECS);
    consoleCooldownRef.current = setInterval(() => {
      setConsoleCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(consoleCooldownRef.current!);
          consoleCooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const [testCaseCooldown, setTestCaseCooldown] = useState(0);
  const tcCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTestCaseCooldown = useCallback(() => {
    if (tcCooldownRef.current) clearInterval(tcCooldownRef.current);
    setTestCaseCooldown(TC_COOLDOWN_SECS);
    tcCooldownRef.current = setInterval(() => {
      setTestCaseCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(tcCooldownRef.current!);
          tcCooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Auto-save infrastructure ────────────────────────────────────────────
  // dirtyQuestionsRef: questions modified since last successful save
  // inFlightRef: questions whose save request is currently in-flight (prevents concurrent saves)
  // debounceTimersRef: per-question debounce timer handles
  const dirtyQuestionsRef = useRef<Set<number>>(new Set());
  const inFlightRef = useRef<Set<number>>(new Set());
  const debounceTimersRef = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});
  const [saveStatus, setSaveStatus] = useState<
    "loaded" | "unsaved" | "saving" | "saved" | "compiling"
  >("loaded");
  const saveStatusRef = useRef(saveStatus);
  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  // Stable refs for editor state — read by every save path without re-creating callbacks
  const perQFilesRef = useRef<Record<number, FileTab[]>>({});
  const perQMainRef = useRef<Record<number, string>>({});
  const examDataRef = useRef(examData);
  useEffect(() => {
    examDataRef.current = examData;
  }, [examData]);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // ── Core save function ───────────────────────────────────────────────────
  // Accepts explicit list of question numbers. Skips already-in-flight questions.
  // Uses Promise.allSettled so one failure never re-queues successful questions.
  const flushQuestions = useCallback(async (qns: number[]) => {
    const lang = examDataRef.current?.exam?.language;
    const sid = sessionIdRef.current;
    if (!lang || !sid) return;

    // Only save questions that are not already being saved and have files
    const toSave = qns.filter(
      (qn) => !inFlightRef.current.has(qn) && !!perQFilesRef.current[qn],
    );
    if (toSave.length === 0) return;

    // Mark in-flight and dequeue from dirty BEFORE the await to avoid double-saving
    toSave.forEach((qn) => {
      inFlightRef.current.add(qn);
      dirtyQuestionsRef.current.delete(qn);
    });
    setSaveStatus("saving");

    const results = await Promise.allSettled(
      toSave.map((qn) => {
        const files = perQFilesRef.current[qn];
        const main = perQMainRef.current[qn];
        return submissionAPI.autosave({
          examSessionId: sid,
          questionNumber: qn,
          code:
            files.find((f) => f.name === main)?.content ??
            files[0]?.content ??
            "",
          language: lang,
          files: files.map((f) => ({ name: f.name, content: f.content })),
          mainFile: main,
        });
      }),
    );

    results.forEach((result, i) => {
      inFlightRef.current.delete(toSave[i]);
      if (result.status === "rejected") {
        // Re-queue only the questions that actually failed
        dirtyQuestionsRef.current.add(toSave[i]);
      }
    });

    setSaveStatus(dirtyQuestionsRef.current.size > 0 ? "unsaved" : "saved");
  }, []); // stable: reads only refs, never re-created

  // ── Initialise per-question state when data arrives ──────────────────────
  // Wait for BOTH examData and savedSubmissionData to settle before initialising
  // so the "only initialise once" guard never fires with stale/undefined saved data.
  useEffect(() => {
    if (!examData?.exam?.questions) return;
    // Don't initialise until submission query has finished (could be null = no saves)
    if (submissionLoading) return;
    const lang: string = examData.exam.language;
    const defaultMain = lang === "java" ? "Main.java" : "main.py";

    examData.exam.questions.forEach((q: Question) => {
      const qn = q.questionNumber;

      // only initialise once
      setPerQFiles((prev) => {
        if (prev[qn]) return prev;
        const saved = savedSubmissionData?.submissions?.find(
          (s: any) => s.questionNumber === qn,
        );
        let files: FileTab[];
        if (saved?.files?.length > 0) {
          files = saved.files.map((f: any) => ({ ...f, language: lang }));
        } else if (saved?.code) {
          files = [
            {
              name: saved.mainFile || defaultMain,
              content: saved.code,
              language: lang,
            },
          ];
        } else if ((q.starterFiles?.length ?? 0) > 0) {
          files = q.starterFiles!.map((sf: any) => ({
            name: sf.name,
            content: sf.content,
            language: lang,
          }));
        } else {
          files = buildDefaultFiles(lang);
        }
        perQFilesRef.current[qn] = files;
        return { ...prev, [qn]: files };
      });

      setPerQMain((prev) => {
        if (prev[qn]) return prev;
        const saved = savedSubmissionData?.submissions?.find(
          (s: any) => s.questionNumber === qn,
        );
        const starterMain =
          !saved && (q.starterFiles?.length ?? 0) > 0
            ? q.defaultMainFile ||
              (q.starterFiles!.find(
                (sf: any) =>
                  sf.name === "Main.java" ||
                  sf.name === "main.java" ||
                  sf.name === "test.java" ||
                  sf.name === "Test.java",
              )?.name ??
                q.starterFiles![0].name)
            : undefined;
        const mainVal = saved?.mainFile || starterMain || defaultMain;
        perQMainRef.current[qn] = mainVal;
        return { ...prev, [qn]: mainVal };
      });

      // Restore test results from saved submission
      setPerQResults((prev) => {
        if (prev[qn]) return prev;
        const saved = savedSubmissionData?.submissions?.find(
          (s: any) => s.questionNumber === qn,
        );
        if (saved?.testResults?.length > 0) {
          return {
            ...prev,
            [qn]: mergeResults(q.testCases, saved.testResults),
          };
        }
        return prev;
      });
    });
  }, [examData, savedSubmissionData, submissionLoading]);

  // ── Split-pane drag (horizontal) ─────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const p = (e.clientX / window.innerWidth) * 100;
      setSplitPosition(Math.min(Math.max(p, 25), 75));
    };
    const onUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // ── Vertical drag for test-case panel ────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isVerticalDragging || !rightPaneRef.current) return;
      const paneRect = rightPaneRef.current.getBoundingClientRect();
      const newHeight = paneRect.bottom - e.clientY;
      setTestCaseHeight(
        Math.min(Math.max(newHeight, 40), paneRect.height - 130),
      );
    };
    const onUp = () => setIsVerticalDragging(false);

    if (isVerticalDragging) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isVerticalDragging]);

  // ── Derived values ───────────────────────────────────────────────────────
  const questions: Question[] = examData?.exam?.questions ?? [];
  const currentQuestion = questions[currentQuestionIdx];
  const currentQN = currentQuestion?.questionNumber;
  // Keep a stable ref so handleCodeChange never captures a stale question number
  currentQNRef.current = currentQN;

  const currentFiles: FileTab[] =
    currentQN != null
      ? (perQFiles[currentQN] ??
        buildDefaultFiles(examData?.exam?.language ?? "java"))
      : [];

  const currentMain: string =
    currentQN != null
      ? (perQMain[currentQN] ??
        currentQuestion?.defaultMainFile ??
        (examData?.exam?.language === "java" ? "Main.java" : "main.py"))
      : "Main.java";

  const currentTestCases: TestCase[] =
    currentQN != null
      ? (perQResults[currentQN] ??
        currentQuestion?.testCases?.map((tc, idx) => ({
          id: idx + 1,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          hasTestFile: tc.hasTestFile,
          status: "pending" as const,
        })) ??
        [])
      : [];

  // ── Reset status to 'loaded' when switching questions ──────────────────
  useEffect(() => {
    if (currentQN == null || !perQFiles[currentQN]) return;
    setSaveStatus("loaded");
  }, [currentQN]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Console run: free run, result shown in editor console panel ─────────────
  const handleRunConsole = useCallback(async () => {
    if (!examData) return;
    if (consoleCooldown > 0) {
      toast.warning(`Please wait ${consoleCooldown}s before running again.`);
      return;
    }
    startConsoleCooldown();
    setIsConsoleRunning(true);
    setConsoleOutput(null);
    try {
      const { data } = await submissionAPI.runConsole({
        files: currentFiles.map((f) => ({ name: f.name, content: f.content })),
        mainFile: currentMain,
        language: examData.exam.language,
      });
      setConsoleOutput({
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        executionTime: data.executionTime ?? 0,
      });
    } catch (err: any) {
      setConsoleOutput({
        stdout: "",
        stderr: err.response?.data?.error || "Execution error",
        executionTime: 0,
      });
    } finally {
      setIsConsoleRunning(false);
    }
  }, [
    currentFiles,
    currentMain,
    examData,
    consoleCooldown,
    startConsoleCooldown,
  ]);

  // ── B: SSE helper — wait for push result instead of polling ─────────────
  // Opens an EventSource and resolves when the server emits the grading result.
  // Falls back gracefully: if SSE fails, caller catches the rejection.
  const waitForSSE = useCallback(
    (submissionId: string, qn: number, tc?: number): Promise<any> =>
      new Promise((resolve, reject) => {
        const tcParam = tc !== undefined ? `&tc=${tc}` : "";
        const es = new EventSource(
          `${BACKEND_URL}/submissions/${submissionId}/events?qn=${qn}${tcParam}`,
          { withCredentials: true },
        );
        const timer = setTimeout(() => {
          es.close();
          reject(new Error("SSE timeout"));
        }, 120_000);
        const abortTick = setInterval(() => {
          if (pollAbort.current) {
            clearTimeout(timer);
            clearInterval(abortTick);
            es.close();
            reject(new Error("aborted"));
          }
        }, 300);
        const cleanup = () => {
          clearTimeout(timer);
          clearInterval(abortTick);
        };
        es.onmessage = (e) => {
          cleanup();
          es.close();
          try {
            resolve(JSON.parse(e.data));
          } catch {
            reject(new Error("parse"));
          }
        };
        es.onerror = () => {
          cleanup();
          es.close();
          reject(new Error("SSE error"));
        };
      }),
    [],
  );

  // ── Run: submit code then wait via SSE until graded ─────────────────────
  const handleRun = useCallback(async () => {
    if (!sessionId || !currentQuestion || !examData) return;
    if (consoleCooldown > 0) {
      toast.warning(`Please wait ${consoleCooldown}s before running again.`);
      return;
    }
    startConsoleCooldown();
    pollAbort.current = false;
    setIsRunning(true);
    setSaveStatus("compiling");
    setPerQResults((prev) => ({
      ...prev,
      [currentQN]: mergeResults(currentQuestion.testCases, []),
    }));

    try {
      const { data } = await submissionAPI.submit({
        examSessionId: sessionId,
        questionNumber: currentQN,
        code: currentFiles[0]?.content ?? "",
        language: examData.exam.language,
        files: currentFiles.map((f) => ({ name: f.name, content: f.content })),
        mainFile: currentMain,
      });

      const submissionId: string =
        data.submissionId ?? savedSubmissionData?._id;
      if (!submissionId) {
        setIsRunning(false);
        return;
      }

      // B: SSE — result pushed the instant grading finishes, no 2 s poll delay
      const result = await waitForSSE(submissionId, currentQN);
      if (result.status === "compile_error") {
        // Push compile error to editor console
        setConsoleOutput({
          stdout: "",
          stderr: result.errorMessage ?? "Compile error",
          executionTime: 0,
        });
        // Mark all test cases as error
        setPerQResults((prev) => ({
          ...prev,
          [currentQN]: mergeResults(currentQuestion.testCases, []).map(
            (tc) => ({
              ...tc,
              status: "error" as const,
              errorMessage: result.errorMessage ?? "Compile error",
            }),
          ),
        }));
      } else {
        setPerQResults((prev) => ({
          ...prev,
          [currentQN]: mergeResults(
            currentQuestion.testCases,
            result.testResults ?? [],
          ),
        }));
      }
    } catch (err) {
      console.error("[Layout] run error:", err);
    } finally {
      setIsRunning(false);
      setSaveStatus("saved");
    }
  }, [
    sessionId,
    currentQuestion,
    currentQN,
    currentFiles,
    currentMain,
    examData,
    savedSubmissionData,
    consoleCooldown,
    startConsoleCooldown,
    waitForSSE,
  ]);

  // ── E+B: Per-testcase run — track index independently, push result via SSE ───
  const handleRunTestCase = useCallback(
    async (testCaseIndex: number) => {
      if (!sessionId || !currentQuestion || !examData) return;
      if (testCaseCooldown > 0) {
        toast.warning(`Please wait ${testCaseCooldown}s before running again.`);
        return;
      }
      startTestCaseCooldown();
      pollAbort.current = false;
      setRunningTestCaseIdx(testCaseIndex); // E: only spinner this TC
      setSaveStatus("compiling");

      // Optimistically mark only this test case as pending
      setPerQResults((prev) => ({
        ...prev,
        [currentQN]: (
          prev[currentQN] ?? mergeResults(currentQuestion.testCases, [])
        ).map((tc, i) =>
          i === testCaseIndex
            ? { ...tc, status: "pending" as const, actualOutput: undefined }
            : tc,
        ),
      }));

      try {
        const { data } = await submissionAPI.submit({
          examSessionId: sessionId,
          questionNumber: currentQN,
          code: currentFiles[0]?.content ?? "",
          language: examData.exam.language,
          files: currentFiles.map((f) => ({
            name: f.name,
            content: f.content,
          })),
          mainFile: currentMain,
          testCaseIndex,
        });

        const submissionId: string =
          data.submissionId ?? savedSubmissionData?._id;
        if (!submissionId) {
          setRunningTestCaseIdx(null);
          return;
        }

        // B: SSE — no poll delay
        const result = await waitForSSE(submissionId, currentQN, testCaseIndex);
        const r = result.testResults?.[testCaseIndex];
        if (r) {
          setPerQResults((prev) => {
            const current = [
              ...(prev[currentQN] ??
                mergeResults(currentQuestion.testCases, [])),
            ];
            if (current[testCaseIndex]) {
              current[testCaseIndex] = {
                ...current[testCaseIndex],
                status: r.status as "passed" | "failed" | "error",
                actualOutput: r.actualOutput,
                errorMessage: r.errorMessage ?? undefined,
                executionTime: r.executionTime,
              };
            }
            return { ...prev, [currentQN]: current };
          });
        } else if (result.status === "compile_error") {
          // Compile error: mark this TC as error with message and push to console
          const errMsg = result.errorMessage ?? "Compile error";
          // Push compile error to editor console so student sees full javac output
          setConsoleOutput({
            stdout: "",
            stderr: errMsg,
            executionTime: 0,
          });
          setPerQResults((prev) => {
            const current = [
              ...(prev[currentQN] ??
                mergeResults(currentQuestion.testCases, [])),
            ];
            if (current[testCaseIndex]) {
              current[testCaseIndex] = {
                ...current[testCaseIndex],
                status: "error" as const,
                errorMessage: errMsg,
              };
            }
            return { ...prev, [currentQN]: current };
          });
        }
      } catch (err) {
        console.error("[Layout] runTestCase error:", err);
      } finally {
        setRunningTestCaseIdx(null);
        setSaveStatus("saved");
      }
    },
    [
      sessionId,
      currentQuestion,
      currentQN,
      currentFiles,
      currentMain,
      examData,
      savedSubmissionData,
      testCaseCooldown,
      startTestCaseCooldown,
      waitForSSE,
    ],
  );

  // ── Submit exam ──────────────────────────────────────────────────────────
  const handleSubmitExam = useCallback(async () => {
    if (
      confirm(
        "Bạn có chắc chắn muốn nộp bài không? Mọi thay đổi sẽ không thể chỉnh sửa!",
      )
    ) {
      try {
        await submissionAPI.submitExam(sessionId!);
        pollAbort.current = true;
        toast.success("Exam submitted successfully!");
        navigate("/student");
      } catch (err) {
        toast.error("Failed to submit exam. Please try again.");
      }
    }
  }, [navigate, sessionId]);

  const handleExit = useCallback(() => {
    if (
      confirm(
        "Bài làm của bạn đã được lưu tự động. Bạn có chắc chắn muốn thoát? Bạn vẫn có thể truy cập lại nếu chưa hết giờ hoặc chưa nộp bài!",
      )
    ) {
      pollAbort.current = true;
      navigate("/student");
    }
  }, [navigate]);

  const handleCodeChange = useCallback(
    (files: FileTab[], main: string) => {
      // Read the live question number from ref — never from the stale closure.
      // This prevents writing file content to the wrong question if the callback
      // fires just after a question switch (e.g. via a React batched update).
      const qn = currentQNRef.current;
      if (qn == null) return;
      // Update refs immediately — save path reads exclusively from refs, never from state
      perQFilesRef.current[qn] = files;
      perQMainRef.current[qn] = main;
      setPerQFiles((prev) => ({ ...prev, [qn]: files }));
      setPerQMain((prev) => ({ ...prev, [qn]: main }));
      dirtyQuestionsRef.current.add(qn);
      setSaveStatus("unsaved");

      // Per-question debounce: save 2 s after the last keystroke for this question.
      // Each question has its own independent timer so typing on Q1 doesn't delay Q2's save.
      clearTimeout(debounceTimersRef.current[qn]);
      debounceTimersRef.current[qn] = setTimeout(() => {
        if (saveStatusRef.current !== "compiling") {
          flushQuestions([qn]);
        }
      }, 2000);
    },
    [flushQuestions], // stable: no longer depends on currentQN state
  );

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  // Ctrl+S  → immediate save
  useHotkey(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { ctrl: true, key: "s" } as any,
    (e: KeyboardEvent) => {
      e.preventDefault();
      if (saveStatusRef.current === "compiling") return;
      const dirty = [...dirtyQuestionsRef.current];
      if (dirty.length > 0) {
        flushQuestions(dirty);
      }
    },
  );

  // Ctrl+Enter → run console
  useHotkey(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { ctrl: true, key: "Enter" } as any,
    (e: KeyboardEvent) => {
      e.preventDefault();
      if (isConsoleRunning || isRunning) return;
      handleRunConsole();
    },
  );

  // ── Backup periodic flush every 10 s ─────────────────────────────────────
  // Catches any dirty questions that slipped through (e.g. debounce fired during compile).
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      if (saveStatusRef.current === "compiling") return;
      const dirty = [...dirtyQuestionsRef.current];
      if (dirty.length > 0) flushQuestions(dirty);
    }, 10_000);
    return () => clearInterval(interval);
  }, [sessionId, flushQuestions]);

  // ── Save on page close / refresh ───────────────────────────────────────────────
  // fetch + keepalive survives tab close; credentials:include sends auth cookies.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const dirty = [...dirtyQuestionsRef.current];
      const lang = examDataRef.current?.exam?.language;
      const sid = sessionIdRef.current;
      if (!dirty.length || !lang || !sid) return;
      dirty.forEach((qn) => {
        const files = perQFilesRef.current[qn];
        const main = perQMainRef.current[qn];
        if (!files) return;
        beaconAutosave(sid, qn, files, main, lang);
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []); // stable: reads only refs

  // ── Flush remaining dirty questions on component unmount ──────────────────
  // Handles React Router navigations (page stays alive, component unmounts).
  // Uses keepalive fetch so no setState is called on an unmounted component.
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(clearTimeout);
      const dirty = [...dirtyQuestionsRef.current];
      const lang = examDataRef.current?.exam?.language;
      const sid = sessionIdRef.current;
      if (!dirty.length || !lang || !sid) return;
      dirty.forEach((qn) => {
        const files = perQFilesRef.current[qn];
        const main = perQMainRef.current[qn];
        if (!files) return;
        beaconAutosave(sid, qn, files, main, lang);
      });
    };
  }, []); // stable: reads only refs

  // ── Error / Loading guards ───────────────────────────────────────────────
  useEffect(() => {
    if (examError) {
      const msg =
        (examError as any)?.response?.data?.error ??
        (examError as any)?.message ??
        "Không thể tải dữ liệu kỳ thi";
      alert(`Lỗi: ${msg}`);
      navigate("/student");
    }
  }, [examError, navigate]);

  if (examLoading || submissionLoading || !examData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-primary animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Đang tải đề thi…</p>
      </div>
    );
  }

  const { exam, session } = examData;
  const pdfUrl: string = exam.pdfResources?.[0] ?? "";
  const examCodeNumber: string = savedSubmissionData?.examCodeNumber ?? "";

  // Compute remaining ms using only server-provided timestamps so the value
  // is never influenced by the client's local clock.
  // session.serverTime = server's wall time at the moment it sent this response.
  // session.endTime    = absolute end time stored in DB.
  // remaining          = endTime − serverTime  (both from server, client clock = irrelevant)
  // This number is then handed to ExamHeader which ticks it down via
  // performance.now(), a monotonic clock immune to system-clock adjustments.
  const serverRemainingMs = Math.max(
    0,
    new Date(session.endTime).getTime() -
      new Date(session.serverTime ?? session.endTime).getTime(),
  );

  return (
    <div className="h-screen flex flex-col bg-[#f1f3f6]">
      {/* Header */}
      <ExamHeader
        examName={exam.examName}
        studentName={user?.name ?? ""}
        studentId={user?.studentId}
        computerOrder={savedSubmissionData?.computerOrder}
        examCode={examCodeNumber}
        initialRemainingMs={serverRemainingMs}
        onSubmit={handleSubmitExam}
        onExit={handleExit}
      />

      {/* Main Content — split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: PDF ── */}
        <div className="overflow-hidden" style={{ width: `${splitPosition}%` }}>
          <div className="h-full">
            <div className="h-full  overflow-hidden shadow-sm border border-gray-200 bg-white">
              <PDFViewer pdfUrl={pdfUrl} className="h-full" />
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div
          className="w-1 flex items-center justify-center cursor-col-resize group select-none"
          onMouseDown={() => setIsDragging(true)}
        >
          <div className="w-1 h-full rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors">
            <GripVertical className="w-3 h-3 text-transparent -ml-1 mt-3.5 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>

        {/* ── Right: editor + test cases ── */}
        <div
          ref={rightPaneRef}
          className="overflow-hidden flex flex-col gap-0"
          style={{ width: `${100 - splitPosition}%` }}
        >
          {/* Code editor */}
          <div className="flex-1 min-h-0">
            {currentQN != null && perQFiles[currentQN] != null && (
              <div className="h-full overflow-hidden">
                <CodeEditor
                  key={currentQN}
                  questions={questions}
                  currentQuestionIdx={currentQuestionIdx}
                  onQuestionChange={setCurrentQuestionIdx}
                  perQResults={perQResults}
                  language={exam.language as "java" | "python"}
                  initialFiles={currentFiles}
                  initialMainFile={currentMain}
                  templateStarterFiles={
                    currentQuestion?.starterFiles?.map((sf) => ({
                      name: sf.name,
                      content: sf.content,
                      language: exam.language,
                    })) ?? []
                  }
                  onCodeChange={handleCodeChange}
                  onRunConsole={handleRunConsole}
                  onRun={handleRun}
                  isRunning={isRunning}
                  isConsoleRunning={isConsoleRunning}
                  consoleOutput={consoleOutput}
                  editorStatus={saveStatus}
                  cooldownRemaining={consoleCooldown}
                />
              </div>
            )}
          </div>

          {/* Vertical resize handle */}
          <div
            className="h-1.5 flex items-center justify-center cursor-row-resize group select-none shrink-0 bg-gray-200 hover:bg-blue-400 transition-colors"
            onMouseDown={() => setIsVerticalDragging(true)}
          >
            <div className="w-8 h-0.5 rounded-full bg-gray-400 group-hover:bg-blue-200 transition-colors" />
          </div>

          {/* Test cases */}
          <div
            className="shrink-0 overflow-hidden"
            style={{ height: testCaseHeight }}
          >
            <TestCases
              testCases={currentTestCases}
              isRunning={isRunning}
              runningTestCaseIdx={runningTestCaseIdx}
              questionNumber={currentQuestion?.questionNumber}
              onRunTestCase={handleRunTestCase}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
