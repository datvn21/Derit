/**
 * Grading helpers - pure functions extracted from the god `submission.js`
 * route. Keeping them side-effect-free makes scoring logic unit-testable
 * without spinning up Mongoose or an executor.
 */

/**
 * Compute a question-level score from its per-testcase passed count.
 *  - Score is a number 0..100 (percentage of testcases passed).
 *  - The route layer should multiply this by `question.points` when
 *    aggregating into the exam's total.
 */
export function computeQuestionScore(testResults = []) {
  if (!Array.isArray(testResults) || testResults.length === 0) return 0;
  const passed = testResults.filter((r) => r?.passed === true).length;
  return Math.round((passed / testResults.length) * 100);
}

/**
 * Aggregate per-question scores into a final exam score that respects
 * `points` weighting. Falls back to the mean when all points are equal.
 */
export function aggregateFinalScore(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) return 0;
  const totalPoints = questions.reduce(
    (sum, q) => sum + (Number.isFinite(q?.points) ? q.points : 1),
    0,
  );
  if (totalPoints <= 0) return 0;
  return questions.reduce((sum, q) => {
    const points = Number.isFinite(q?.points) ? q.points : 1;
    const ratio = computeQuestionScore(q?.testResults) / 100;
    return sum + points * ratio;
  }, 0);
}

/**
 * Build a normalised per-question payload suitable for embedding into a
 * StudentSubmission document. Centralising the shape means the
 * submission route no longer keeps its own ad-hoc copies.
 */
export function buildQuestionSubmission({
  questionNumber,
  code,
  files,
  mainFile,
  language,
}) {
  const normalisedFiles = normalizeFiles(files);
  const normalisedCode = normalizeLineEndings(code);
  const mainContent =
    normalisedFiles.find((f) => f.name === mainFile)?.content ??
    normalisedFiles[0]?.content ??
    "";
  const finalCode = normalisedCode || mainContent;

  return {
    questionNumber,
    code: finalCode,
    language,
    files: normalisedFiles,
    mainFile: mainFile || null,
    status: "pending",
    testResults: [],
    totalScore: 0,
    submittedAt: new Date(),
  };
}

/** Normalise an array of `{ name, content }` files in place. */
export function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.map((file) => ({
    ...file,
    content: normalizeLineEndings(file?.content),
  }));
}

/** Convert CRLF/CR line endings to LF. */
export function normalizeLineEndings(value) {
  if (typeof value !== "string") return value;
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Sort + coalesce test results so the saved payload only includes the
 * latest run per test case. Used by the regrade path.
 */
export function pickLatestTestResults(runs = []) {
  if (!Array.isArray(runs) || runs.length === 0) return [];
  // runs: array of [ { testCaseId, passed, ... } ] arrays. We accept the
  // last full array.
  return runs[runs.length - 1] || [];
}
