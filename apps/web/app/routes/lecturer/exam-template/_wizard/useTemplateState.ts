/**
 * `useTemplateState` — single source of truth for the wizard's mutable
 * template payload (info + codes + questions + test cases + starter files).
 *
 * Both Create and Edit use this hook; the reducer-style API keeps
 * state mutations explicit and easy to reason about (no nested
 * `setExamCodes(prev => prev.map(…))` chains in components).
 */
import { useCallback, useState } from "react";
import {
  emptyExamCode,
  emptyQuestion,
  emptyTestCase,
  type ExamCode,
  type ExamType,
  type Language,
  type Question,
  type StarterFile,
  type TestCase,
} from "./types";

export interface TemplateMeta {
  templateName: string;
  examType: ExamType;
  language: Language;
  duration: number;
}

export interface UseTemplateStateResult {
  meta: TemplateMeta;
  setMeta: (patch: Partial<TemplateMeta>) => void;
  examCodes: ExamCode[];
  /** Replace the entire payload (used by Edit to hydrate from server). */
  hydrate: (payload: { meta: TemplateMeta; codes: ExamCode[] }) => void;
  // Codes
  addExamCode: () => void;
  removeExamCode: (index: number) => void;
  updateExamCodeField: <K extends keyof ExamCode>(
    index: number,
    field: K,
    value: ExamCode[K],
  ) => void;
  // Questions
  addQuestion: (codeIndex: number) => void;
  removeQuestion: (codeIndex: number, questionIndex: number) => void;
  updateQuestion: <K extends keyof Question>(
    codeIndex: number,
    questionIndex: number,
    field: K,
    value: Question[K],
  ) => void;
  // Test cases
  addTestCase: (codeIndex: number, questionIndex: number) => void;
  removeTestCase: (
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
  ) => void;
  updateTestCase: <K extends keyof TestCase>(
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
    field: K,
    value: TestCase[K],
  ) => void;
  // Starter files
  addStarterFile: (
    codeIndex: number,
    questionIndex: number,
    file: StarterFile,
  ) => void;
  removeStarterFile: (
    codeIndex: number,
    questionIndex: number,
    fileIndex: number,
  ) => void;
  toggleStarterFileDownload: (
    codeIndex: number,
    questionIndex: number,
    fileIndex: number,
  ) => void;
  setDefaultMainFile: (
    codeIndex: number,
    questionIndex: number,
    fileName: string,
  ) => void;
  // PDF
  setPdfFile: (codeIndex: number, file: File) => void;
}

const INITIAL_META: TemplateMeta = {
  templateName: "",
  examType: "OOP",
  language: "java",
  duration: 45,
};

export function useTemplateState(
  initialMeta: TemplateMeta = INITIAL_META,
  initialCodes: ExamCode[] = [emptyExamCode("1")],
): UseTemplateStateResult {
  const [meta, setMetaState] = useState<TemplateMeta>(initialMeta);
  const [examCodes, setExamCodes] = useState<ExamCode[]>(initialCodes);

  const setMeta = useCallback((patch: Partial<TemplateMeta>) => {
    setMetaState((prev) => ({ ...prev, ...patch }));
  }, []);

  const hydrate = useCallback(
    (payload: { meta: TemplateMeta; codes: ExamCode[] }) => {
      setMetaState(payload.meta);
      setExamCodes(payload.codes);
    },
    [],
  );

  // ── Codes ──────────────────────────────────────────────────────────────

  const addExamCode = useCallback(() => {
    setExamCodes((prev) => {
      const nextNumber = String(prev.length + 1);
      return [...prev, emptyExamCode(nextNumber)];
    });
  }, []);

  const removeExamCode = useCallback(
    (index: number) => {
      setExamCodes((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((_, i) => i !== index);
      });
    },
    [],
  );

  const updateExamCodeField = useCallback(
    <K extends keyof ExamCode>(index: number, field: K, value: ExamCode[K]) => {
      setExamCodes((prev) =>
        prev.map((code, i) =>
          i === index ? { ...code, [field]: value } : code,
        ),
      );
    },
    [],
  );

  const setPdfFile = useCallback((codeIndex: number, file: File) => {
    setExamCodes((prev) =>
      prev.map((code, i) =>
        i === codeIndex
          ? { ...code, pdfFile: file, pdfUrl: "" }
          : code,
      ),
    );
  }, []);

  // ── Questions ──────────────────────────────────────────────────────────

  const addQuestion = useCallback((codeIndex: number) => {
    setExamCodes((prev) =>
      prev.map((code, ci) => {
        if (ci !== codeIndex) return code;
        const nextNumber = code.questions.length + 1;
        return {
          ...code,
          questions: [...code.questions, emptyQuestion(nextNumber)],
        };
      }),
    );
  }, []);

  const removeQuestion = useCallback(
    (codeIndex: number, questionIndex: number) => {
      setExamCodes((prev) =>
        prev.map((code, ci) => {
          if (ci !== codeIndex) return code;
          if (code.questions.length <= 1) return code;
          const next = code.questions.filter((_, qi) => qi !== questionIndex);
          next.forEach((q, i) => (q.questionNumber = i + 1));
          return { ...code, questions: next };
        }),
      );
    },
    [],
  );

  const updateQuestion = useCallback(
    <K extends keyof Question>(
      codeIndex: number,
      questionIndex: number,
      field: K,
      value: Question[K],
    ) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi === questionIndex ? { ...q, [field]: value } : q,
                ),
              },
        ),
      );
    },
    [],
  );

  // ── Test cases ─────────────────────────────────────────────────────────

  const addTestCase = useCallback(
    (codeIndex: number, questionIndex: number) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : { ...q, testCases: [...q.testCases, emptyTestCase()] },
                ),
              },
        ),
      );
    },
    [],
  );

  const removeTestCase = useCallback(
    (codeIndex: number, questionIndex: number, testCaseIndex: number) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        testCases:
                          q.testCases.length > 1
                            ? q.testCases.filter(
                                (_, ti) => ti !== testCaseIndex,
                              )
                            : q.testCases,
                      },
                ),
              },
        ),
      );
    },
    [],
  );

  const updateTestCase = useCallback(
    <K extends keyof TestCase>(
      codeIndex: number,
      questionIndex: number,
      testCaseIndex: number,
      field: K,
      value: TestCase[K],
    ) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        testCases: q.testCases.map((tc, ti) =>
                          ti === testCaseIndex
                            ? { ...tc, [field]: value }
                            : tc,
                        ),
                      },
                ),
              },
        ),
      );
    },
    [],
  );

  // ── Starter files ──────────────────────────────────────────────────────

  const addStarterFile = useCallback(
    (codeIndex: number, questionIndex: number, file: StarterFile) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        starterFiles: [
                          ...q.starterFiles,
                          { ...file, canDownload: false },
                        ],
                      },
                ),
              },
        ),
      );
    },
    [],
  );

  const removeStarterFile = useCallback(
    (codeIndex: number, questionIndex: number, fileIndex: number) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) => {
                  if (qi !== questionIndex) return q;
                  const removed = q.starterFiles[fileIndex];
                  return {
                    ...q,
                    starterFiles: q.starterFiles.filter(
                      (_, i) => i !== fileIndex,
                    ),
                    defaultMainFile:
                      q.defaultMainFile === removed?.name
                        ? undefined
                        : q.defaultMainFile,
                  };
                }),
              },
        ),
      );
    },
    [],
  );

  const toggleStarterFileDownload = useCallback(
    (codeIndex: number, questionIndex: number, fileIndex: number) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        starterFiles: q.starterFiles.map((sf, i) =>
                          i === fileIndex
                            ? { ...sf, canDownload: !sf.canDownload }
                            : sf,
                        ),
                      },
                ),
              },
        ),
      );
    },
    [],
  );

  const setDefaultMainFile = useCallback(
    (codeIndex: number, questionIndex: number, fileName: string) => {
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        defaultMainFile:
                          q.defaultMainFile === fileName ? undefined : fileName,
                      },
                ),
              },
        ),
      );
    },
    [],
  );

  return {
    meta,
    setMeta,
    examCodes,
    hydrate,
    addExamCode,
    removeExamCode,
    updateExamCodeField,
    addQuestion,
    removeQuestion,
    updateQuestion,
    addTestCase,
    removeTestCase,
    updateTestCase,
    addStarterFile,
    removeStarterFile,
    toggleStarterFileDownload,
    setDefaultMainFile,
    setPdfFile,
  };
}
