import type { MutableRefObject } from "react";
import { BACKEND_URL, submissionAPI } from "~/lib/api";

export interface RunSubmissionArgs {
  sessionId: string;
  questionNumber: number;
  language: string;
  files: Array<{ name: string; content: string }>;
  mainFile: string;
  testCaseIndex?: number;
  fallbackSubmissionId?: string;
  abortRef?: MutableRefObject<boolean>;
}

export interface RunResult {
  status: string;
  testResults?: Array<{
    status: "passed" | "failed" | "error";
    actualOutput?: string;
    expectedOutput?: string;
    errorMessage?: string;
    executionTime?: number;
  }>;
  errorMessage?: string;
}

/**
 * Shared submission pipeline used by both full-run (`handleRun`) and per-test
 * (`handleRunTestCase`):
 *  1. POST /submissions with the code/files
 *  2. Wait for the SSE grading event from the server
 *
 * The helper returns the parsed SSE payload. The caller decides how to merge
 * it into the per-question results UI.
 */
export async function runSubmission(args: RunSubmissionArgs): Promise<RunResult> {
  const { sessionId, questionNumber, language, files, mainFile, testCaseIndex, fallbackSubmissionId, abortRef } = args;
  const { data } = await submissionAPI.submit({
    examSessionId: sessionId,
    questionNumber,
    code: files[0]?.content ?? "",
    language,
    files: files.map((f) => ({ name: f.name, content: f.content })),
    mainFile,
    testCaseIndex,
  });

  const submissionId: string = data.submissionId ?? fallbackSubmissionId ?? "";
  if (!submissionId) {
    throw new Error("No submission id returned by server");
  }

  return waitForGrading(submissionId, questionNumber, testCaseIndex, abortRef);
}

/**
 * Opens an EventSource on `/submissions/:id/events` and resolves when the
 * server emits the grading result. Closes the stream on success, error, or
 * timeout (2 minutes). If `abortRef` flips to true, rejects with "aborted".
 */
export function waitForGrading(
  submissionId: string,
  questionNumber: number,
  testCaseIndex?: number,
  abortRef?: MutableRefObject<boolean>,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const tcParam = testCaseIndex !== undefined ? `&tc=${testCaseIndex}` : "";
    const url = `${BACKEND_URL}/submissions/${submissionId}/events?qn=${questionNumber}${tcParam}`;
    const es = new EventSource(url, { withCredentials: true });

    let abortTick: ReturnType<typeof setInterval> | null = null;
    const cleanup = () => {
      clearTimeout(timer);
      if (abortTick) clearInterval(abortTick);
      es.close();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("SSE timeout"));
    }, 120_000);

    if (abortRef) {
      abortTick = setInterval(() => {
        if (abortRef.current) {
          cleanup();
          reject(new Error("aborted"));
        }
      }, 300);
    }

    es.onmessage = (e) => {
      cleanup();
      try {
        resolve(JSON.parse(e.data) as RunResult);
      } catch {
        reject(new Error("parse"));
      }
    };
    es.onerror = () => {
      cleanup();
      reject(new Error("SSE error"));
    };
  });
}