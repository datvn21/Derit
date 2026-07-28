/**
 * Pure scoring helpers used by the lecturer Results page.
 * Extracted from `ExamSessionResults.tsx` so they can be unit-tested without
 * pulling in React or query-client state.
 */

export interface StudentSubmissionLike {
  _id: string;
  studentId: unknown;
  examCodeNumber?: string;
  isSubmitted?: boolean;
  tabSwitchCount?: number;
  joinCount?: number;
  finalScore?: number;
  submissions?: Array<{
    questionNumber: number;
    status: string;
    testResults?: Array<{ status: string }>;
  }>;
}

export interface ResultsRow {
  id: string;
  student: unknown;
  examCode: string;
  isSubmitted: boolean;
  tabSwitches: number;
  joinCount: number;
  questions: Array<{ passed: number; total: number; status: string }>;
  totalPassed: number;
  totalTests: number;
  pct: number;
  score10: number;
}

export function passedTests(sub: { testResults?: Array<{ status: string }> }): number {
  return (sub.testResults ?? []).filter((r) => r.status === "passed").length;
}

export function totalTests(sub: { testResults?: Array<{ status: string }> }): number {
  return (sub.testResults ?? []).length;
}

/** Compute per-student row data from raw StudentSubmission */
export function buildRow(submission: StudentSubmissionLike, maxQuestions: number): ResultsRow {
  const questions = Array.from({ length: maxQuestions }, () => ({
    passed: 0,
    total: 0,
    status: "—",
  }));

  let totalPassed = 0;
  let totalTestCount = 0;

  for (const q of submission.submissions ?? []) {
    const idx = q.questionNumber - 1;
    if (idx >= 0 && idx < maxQuestions) {
      const p = passedTests(q);
      const t = totalTests(q);
      questions[idx] = { passed: p, total: t, status: q.status };
      totalPassed += p;
      totalTestCount += t;
    }
  }

  return {
    id: submission._id,
    student: submission.studentId,
    examCode: submission.examCodeNumber ?? "",
    isSubmitted: submission.isSubmitted ?? false,
    tabSwitches: submission.tabSwitchCount ?? 0,
    joinCount: submission.joinCount ?? 0,
    questions,
    totalPassed,
    totalTests: totalTestCount,
    pct: totalTestCount > 0 ? Math.round((totalPassed / totalTestCount) * 100) : 0,
    score10:
      submission.finalScore ??
      (totalTestCount > 0 ? Math.round((totalPassed / totalTestCount) * 10 * 10) / 10 : 0),
  };
}

export function scoreChipClass(passed: number, total: number, status: string): string {
  if (status === "compile_error")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "runtime_error" || status === "time_limit_exceeded")
    return "bg-warning/15 text-warning border-warning/30";
  if (status === "partial")
    return "bg-warning/15 text-warning border-warning/30";
  if (total === 0) return "bg-muted text-muted-foreground border-border";
  const pct = Math.round((passed / total) * 100);
  if (pct >= 80) return "bg-success/10 text-success border-success/30";
  if (pct >= 40) return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}