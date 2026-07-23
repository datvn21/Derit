/**
 * `useAutosave` — debounced, page-lifecycle-safe autosave for the exam
 * editor. Wraps `beaconAutosave` from `examUtils` so the keepalive logic
 * stays where it can be unit-tested.
 *
 * Behaviour:
 *  - Each call to `schedule(content)` debounces a beacon write so rapid
 *    typing only flushes one request every `intervalMs`.
 *  - `flushNow()` triggers an immediate write — used before unload / route
 *    transitions.
 *  - The interval timer is also flushed on `pagehide` / `beforeunload` to
 *    avoid losing the last keystrokes when the user navigates away.
 */
import { useCallback, useEffect, useRef } from "react";
import { beaconAutosave, type FileTab } from "~/components/Exam/examUtils";

interface AutosaveArgs {
  examSessionId: string | null;
  questionNumber: number;
  files: FileTab[];
  mainFile: string;
  language: string;
  intervalMs?: number;
}

export function useAutosave(args: AutosaveArgs) {
  const { examSessionId, questionNumber, files, mainFile, language, intervalMs = 1500 } = args;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef({ files, mainFile });

  // Keep the latest args in a ref so the debounce timer sees fresh state.
  useEffect(() => {
    lastArgsRef.current = { files, mainFile };
  }, [files, mainFile]);

  // Clear pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Flush on tab close / hide.
  useEffect(() => {
    function flush() {
      if (!examSessionId) return;
      beaconAutosave(examSessionId, questionNumber, lastArgsRef.current.files, lastArgsRef.current.mainFile, language);
    }
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [examSessionId, questionNumber, language]);

  const schedule = useCallback(() => {
    if (!examSessionId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      beaconAutosave(
        examSessionId,
        questionNumber,
        lastArgsRef.current.files,
        lastArgsRef.current.mainFile,
        language,
      );
    }, intervalMs);
  }, [examSessionId, questionNumber, language, intervalMs]);

  const flushNow = useCallback(() => {
    if (!examSessionId) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    beaconAutosave(
      examSessionId,
      questionNumber,
      lastArgsRef.current.files,
      lastArgsRef.current.mainFile,
      language,
    );
  }, [examSessionId, questionNumber, language]);

  return { schedule, flushNow };
}
