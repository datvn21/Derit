/**
 * Pure helpers and types shared by the exam workspace components.
 *
 * Anything that doesn't depend on React or the network lives here so it can
 * be unit-tested in isolation and reused by hooks (e.g. `useAutosave`).
 */
import { BACKEND_URL } from "~/lib/api";

export interface FileTab {
  name: string;
  content: string;
  language: string;
}

export interface QuestionTestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  hasTestFile?: boolean;
}

export interface QuestionShape {
  questionNumber: number;
  title: string;
  testCases: QuestionTestCase[];
  starterFiles?: Array<{ name: string; content: string }>;
  defaultMainFile?: string;
}

/** Returns a starter file for the given exam language. */
export function getDefaultTemplate(language: string): string {
  if (language === "java") {
    return `public class Main {
    public static void main(String[] args) {
        // Write your code here
    }
}`;
  }
  if (language === "cpp") {
    return `#include <iostream>
int main() {
    // Write your code here
    return 0;
}
`;
  }
  if (language === "javascript") {
    return `// Write your code here
function main() {}
main();
`;
  }
  return `# Write your code here\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n`;
}

const EXTENSION_BY_LANGUAGE: Record<string, string> = {
  java: "java",
  python: "py",
  cpp: "cpp",
  javascript: "js",
};

export function defaultMainFileName(language: string): string {
  if (language === "java") return "Main.java";
  if (language === "cpp") return "main.cpp";
  if (language === "javascript") return "main.js";
  return "main.py";
}

/** Builds the initial single-file tabs for a fresh question. */
export function buildDefaultFiles(language: string): FileTab[] {
  const ext = EXTENSION_BY_LANGUAGE[language] || "txt";
  const name =
    language === "java"
      ? "Main.java"
      : language === "cpp"
      ? "main.cpp"
      : language === "javascript"
      ? "main.js"
      : "main.py";
  void ext;
  return [{ name, content: getDefaultTemplate(language), language }];
}

/**
 * Best-effort fire-and-forget autosave via fetch(keepalive). Safe to call
 * from `beforeunload`/`visibilitychange` cleanup because:
 *  - keepalive: true keeps the request alive past the page lifecycle
 *  - credentials: "include" sends the session cookie cross-origin
 *  - no awaits / no React state means it can run after unmount
 */
export function beaconAutosave(
  examSessionId: string,
  questionNumber: number,
  files: FileTab[],
  mainFile: string,
  language: string,
): void {
  if (!examSessionId) return;
  const mainContent =
    files.find((f) => f.name === mainFile)?.content ?? files[0]?.content ?? "";
  const body = JSON.stringify({
    examSessionId,
    questionNumber,
    code: mainContent,
    language,
    files: files.map((f) => ({ name: f.name, content: f.content })),
    mainFile,
  });
  fetch(`${BACKEND_URL}/submissions/autosave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body,
  }).catch(() => {
    /* best-effort: drop errors silently */
  });
}

interface RawTestResult {
  status: "passed" | "failed" | "error" | "pending";
  actualOutput?: string;
  errorMessage?: string;
  executionTime?: number;
}

export interface DisplayTestCase {
  id: number;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  hasTestFile?: boolean;
  status: "passed" | "failed" | "error" | "pending";
  actualOutput?: string;
  errorMessage?: string;
  executionTime?: number;
}

/** Project a question's expected test cases + saved results into the display shape. */
export function mergeResults(
  questionTestCases: QuestionTestCase[],
  testResults: RawTestResult[] = [],
): DisplayTestCase[] {
  return questionTestCases.map((tc, idx) => {
    const r = testResults[idx];
    return {
      id: idx + 1,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden,
      hasTestFile: tc.hasTestFile,
      status: r ? (r.status as "passed" | "failed" | "error") : "pending",
      actualOutput: r?.actualOutput,
      errorMessage: r?.errorMessage,
      executionTime: r?.executionTime,
    };
  });
}
