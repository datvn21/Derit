// Shared types for DERIT

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'lecturer' | 'student';
}

export interface Exam {
  _id: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  points: number;
  testCases: TestCase[];
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface ExamSession {
  _id: string;
  examId: string;
  classroomId: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'active' | 'completed';
}

export interface Submission {
  _id: string;
  sessionId: string;
  questionId: string;
  code: string;
  language: 'java' | 'python' | 'cpp';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
  result?: {
    passed: number;
    total: number;
    executionTime: number;
    output: string;
  };
  submittedAt: Date;
}

export interface Result {
  _id: string;
  sessionId: string;
  studentId: string;
  score: number;
  submissions: Submission[];
}

export interface Classroom {
  _id: string;
  name: string;
  description: string;
  lecturerId: string;
  studentIds: string[];
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
