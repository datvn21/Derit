/**
 * Shared types and helpers for the exam-template wizard.
 *
 * Both `ExamTemplateCreate.tsx` and `ExamTemplateEdit.tsx` import these.
 * Anything that touches wizard state or step components goes through here
 * so that adding steps doesn't require touching the route files.
 */

export interface StarterFile {
  name: string;
  content: string;
  canDownload?: boolean;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  testFile?: { name: string; content: string };
  extraFiles?: { name: string; content: string }[];
}

export interface Question {
  questionNumber: number;
  title: string;
  testCases: TestCase[];
  starterFiles: StarterFile[];
  defaultMainFile?: string;
}

export interface ExamCode {
  codeNumber: string;
  /** Existing URL (after upload, or when editing). */
  pdfUrl: string;
  /** Pending file from the user's browser, uploaded on submit. */
  pdfFile?: File | null;
  questions: Question[];
}

export type ExamType = "OOP" | "DSA" | "General";
export type Language = "java" | "python" | "cpp" | "javascript";

export const LANGUAGES_FOR_GENERAL: Language[] = [
  "java",
  "python",
  "cpp",
  "javascript",
];

export function emptyTestCase(): TestCase {
  return { input: "", expectedOutput: "", isHidden: false, extraFiles: [] };
}

export function emptyQuestion(questionNumber: number): Question {
  return {
    questionNumber,
    title: "",
    testCases: [emptyTestCase()],
    starterFiles: [],
  };
}

export function emptyExamCode(codeNumber: string): ExamCode {
  return {
    codeNumber,
    pdfUrl: "",
    pdfFile: null,
    questions: [emptyQuestion(1)],
  };
}export const STARTER_FILE_ACCEPT =
  ".java,.py,.js,.ts,.c,.cpp,.h,.txt,.inp";
export const TEST_FILE_ACCEPT = ".java,.py";
export const EXTRA_FILE_ACCEPT =
  ".java,.py,.txt,.inp,.csv,.json,.xml,.dat";