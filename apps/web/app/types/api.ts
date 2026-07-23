/**
 * Domain types shared across the web app.
 *
 * Until we wire up an OpenAPI generator, these mirror the response shapes
 * produced by the Derit server. Keep them in sync with backend changes.
 */

export type Role = "student" | "lecturer" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: Role;
  studentId?: string | null;
  isActive: boolean;
  isSuperAdmin?: boolean;
  adminPermissions?: string[];
}

export interface ExamTemplateSummary {
  _id: string;
  examName?: string;
  templateName?: string;
  duration: number;
  examType: "OOP" | "DSA" | "General" | string;
  language: "java" | "python" | "cpp" | "javascript" | string;
  totalPoints?: number;
  examCodeCount?: number;
  isPublished?: boolean;
  createdAt?: string;
}

export interface ExamSessionUser {
  _id: string;
  name: string;
  email: string;
  studentId?: string;
  avatar?: string;
}

export interface ExamSession {
  _id: string;
  sessionName: string;
  roomCode: string;
  status: "ongoing" | "scheduled" | "ended" | "graded" | "draft";
  startTime: string;
  endTime: string;
  duration?: number;
  examTemplateId?: ExamTemplateSummary;
  createdBy?: ExamSessionUser;
  whitelist?: string[];
  blacklist?: string[];
  classroomIds?: string[];
  entryMode?: string;
  hasComputerOrder?: boolean;
  isPending?: boolean;
  isSubmitted?: boolean;
}

export interface TestCase {
  _id?: string;
  questionNumber?: number;
  input: string;
  expectedOutput: string;
  extraFiles?: { name: string; content: string }[];
}

export interface ExamQuestion {
  questionNumber: number;
  title?: string;
  questionText?: string;
  points: number;
  testCases: TestCase[];
  pdfFile?: { url: string };
}

export interface ExamCode {
  codeNumber: string | number;
  code: string;
  questions: ExamQuestion[];
}

export interface ExamTemplate extends ExamTemplateSummary {
  examCodes: ExamCode[];
}

export type SubmissionStatus =
  | "pending"
  | "running"
  | "accepted"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "partial"
  | "not_submitted";

export type TestResultStatus = "passed" | "failed" | "error" | "pending";

export interface SubmissionTestResult {
  testcaseId: string | number;
  testCaseId?: number;
  status?: TestResultStatus;
  passed?: boolean;
  executionTime: number;
  output?: string;
  actualOutput?: string;
  error?: string;
  errorMessage?: string;
}

export interface QuestionSubmission {
  questionNumber: number;
  code: string;
  language: string;
  files?: { name: string; content: string }[];
  mainFile?: string | null;
  status: SubmissionStatus;
  testResults?: SubmissionTestResult[];
  totalScore: number;
  submittedAt: string;
}

export interface StudentSubmission {
  _id: string;
  examSessionId: string;
  studentId: ExamSessionUser | string;
  examCodeNumber: string;
  submissions: QuestionSubmission[];
  finalScore: number;
  isSubmitted: boolean;
  submittedAt: string;
  joinCount?: number;
  tabSwitchCount?: number;
}

export interface Classroom {
  _id: string;
  classroomName: string;
  students: string[];
  createdBy?: string;
  createdAt?: string;
}

export interface ActivityLog {
  _id: string;
  activityType: string;
  userId: ExamSessionUser | string;
  examSessionId?: string | null;
  questionNumber?: number | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface QuestionScore {
  questionId: string | { _id: string; title?: string };
  bestScore: number;
  totalAttempts: number;
  bestSubmissionId?: string | null;
}

export interface ExamResult {
  _id: string;
  examSessionId: {
    _id: string;
    sessionName: string;
    examTemplateId?: {
      _id: string;
      examName: string;
      duration?: number;
    };
  };
  studentId: string;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  rank: number | null;
  questionScores: QuestionScore[];
  startedAt: string;
  lastSubmittedAt: string | null;
  totalTimeSpent: number;
  tabSwitchCount: number;
  suspiciousActivities: string[];
  isFinalized: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminSettings {
  systemName?: string;
  allowStudentRegistration?: boolean;
  requireEmailVerification?: boolean;
  defaultCompileTimeout?: number;
  defaultRunTimeout?: number;
  maxConcurrentSubmissions?: number;
  sessionExpiryHours?: number;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;
  allowedStudentDomains?: string[];
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  autoGradingEnabled?: boolean;
  plagiarismDetectionEnabled?: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  requestId?: string;
}

export const isApiError = (value: unknown): value is ApiError =>
  !!value &&
  typeof value === "object" &&
  "status" in value &&
  typeof (value as { status: unknown }).status === "number";
