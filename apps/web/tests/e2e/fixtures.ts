import { expect, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export type Role = "student" | "lecturer" | "admin";

const backendPattern = /http:\/\/localhost:5001\/(.+)/;

export const users = {
  student: {
    id: "student-1",
    _id: "student-1",
    email: "521H0001@student.tdtu.edu.vn",
    name: "Nguyen Van An",
    avatar: "",
    role: "student",
    studentId: "521H0001",
    isActive: true,
  },
  lecturer: {
    id: "lecturer-1",
    _id: "lecturer-1",
    email: "lecturer@tdtu.edu.vn",
    name: "Dr. Tran Minh",
    avatar: "",
    role: "lecturer",
    isActive: true,
  },
  admin: {
    id: "admin-1",
    _id: "admin-1",
    email: "admin@tdtu.edu.vn",
    name: "Super Admin",
    avatar: "",
    role: "admin",
    isActive: true,
    isSuperAdmin: true,
  },
} as const;

export const fixtures = {
  templates: [
    {
      _id: "tpl-1",
      templateName: "Java Arrays Final",
      examName: "Java Arrays Final",
      examType: "midterm",
      language: "java",
      duration: 90,
      isPublished: true,
      examCodeCount: 2,
      examCodes: [
        {
          codeNumber: "1",
          pdfUrl: "/mock/sample.pdf",
          title: "Code A",
          questions: [
            {
              questionNumber: 1,
              title: "Sum array",
              description: "Read integers and print their sum.",
              score: 10,
              starterFiles: [{ name: "Main.java", content: "public class Main {}", language: "java" }],
              defaultMainFile: "Main.java",
              testCases: [{
                input: "1 2",
                expectedOutput: "3",
                isHidden: false,
                testFile: { name: "Test1.java", content: "public class Test1 {}" },
              }],
            },
          ],
        },
      ],
    },
    {
      _id: "tpl-2",
      templateName: "Python Strings",
      examName: "Python Strings",
      examType: "practice",
      language: "python",
      duration: 45,
      isPublished: false,
      examCodeCount: 1,
      examCodes: [],
    },
  ],
  classrooms: [
    {
      _id: "class-1",
      classroomName: "K21 OOP - Group A",
      students: ["521H0001", "521H0002", "521H0003", "521H0004"],
      createdAt: "2026-07-20T08:00:00.000Z",
    },
    {
      _id: "class-2",
      classroomName: "K22 DSA - Nhom Viet",
      students: ["522H0001"],
      createdAt: "2026-07-21T08:00:00.000Z",
    },
  ],
  sessions: [
    {
      _id: "session-1",
      sessionName: "Java Midterm Room 101",
      roomCode: "ROOM101",
      accessKey: "SECRET",
      status: "ongoing",
      hasComputerOrder: false,
      startTime: "2026-07-25T02:00:00.000Z",
      endTime: "2026-07-25T05:00:00.000Z",
      createdBy: { name: "Dr. Tran Minh" },
      examTemplateId: { _id: "tpl-1", examName: "Java Arrays Final", duration: 90 },
    },
    {
      _id: "session-2",
      sessionName: "Submitted Practice",
      roomCode: "DONE01",
      status: "scheduled",
      isSubmitted: true,
      hasComputerOrder: true,
      startTime: "2026-07-26T02:00:00.000Z",
      endTime: "2026-07-26T03:00:00.000Z",
      createdBy: { name: "Dr. Tran Minh" },
      examTemplateId: { _id: "tpl-2", examName: "Python Strings", duration: 45 },
    },
  ],
  exam: {
    exam: {
      _id: "tpl-1",
      examName: "Java Arrays Final",
      templateName: "Java Arrays Final",
      language: "java",
      pdfResources: ["/mock/sample.pdf"],
      questions: [
        {
          questionNumber: 1,
          title: "Sum array",
          defaultMainFile: "Main.java",
          starterFiles: [
            {
              name: "Main.java",
              content:
                "public class Main { public static void main(String[] args) { System.out.println(\"3\"); } }",
            },
          ],
          testCases: [
            { input: "1 2", expectedOutput: "3", isHidden: false, hasTestFile: true },
            { input: "2 3", expectedOutput: "5", isHidden: true, hasTestFile: true },
          ],
        },
        {
          questionNumber: 2,
          title: "Reverse string",
          defaultMainFile: "Main.java",
          starterFiles: [{ name: "Main.java", content: "public class Main {}" }],
          testCases: [{ input: "abc", expectedOutput: "cba", isHidden: false, hasTestFile: true }],
        },
      ],
    },
    session: {
      _id: "session-1",
      sessionName: "Java Midterm Room 101",
      endTime: "2026-07-25T05:00:00.000Z",
      serverTime: "2026-07-25T02:00:00.000Z",
    },
  },
};

export function installPageGuards(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (
      msg.type() === "error" &&
      !/Failed to load resource/.test(text) &&
      !/Failed to fetch manifest patches/.test(text)
    ) {
      consoleErrors.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") {
      return;
    }
    if (
      (request.url().includes("/node_modules/.vite/deps/") ||
        request.url().includes("/__manifest") ||
        request.url().includes("fonts.gstatic.com")) &&
      request.failure()?.errorText === "net::ERR_ABORTED"
    ) {
      return;
    }
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
  });

  return {
    async assertClean() {
      expect(consoleErrors, "unexpected browser console errors").toEqual([]);
      expect(failedRequests, "unexpected failed browser requests").toEqual([]);
    },
  };
}

export async function mockBackend(page: Page, role: Role | null = null) {
  await page.addInitScript(() => {
    class MockEventSource {
      url: string;
      withCredentials: boolean;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(url: string, init?: EventSourceInit) {
        this.url = url;
        this.withCredentials = !!init?.withCredentials;
        setTimeout(() => {
          const payload = url.includes("regrade-progress")
            ? { type: "done", graded: 1, total: 1 }
            : {
                status: "graded",
                testResults: [
                  { status: "passed", actualOutput: "3", executionTime: 12 },
                  { status: "passed", actualOutput: "5", executionTime: 14 },
                ],
              };
          this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }));
        }, 100);
      }
      close() {}
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() {
        return true;
      }
      CONNECTING = 0;
      OPEN = 1;
      CLOSED = 2;
      readyState = 1;
    }
    // @ts-expect-error test shim
    window.EventSource = MockEventSource;
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("https://cdnjs.cloudflare.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const match = url.match(backendPattern);
    if (!match) return route.continue();

    const path = `/${match[1]}`;
    const method = route.request().method();
    return fulfillApi(route, method, path, role);
  });
  await page.route("**/mock/sample.pdf", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: fs.readFileSync(path.join(process.cwd(), "tests/e2e/assets/sample.pdf")),
    }),
  );
}

async function fulfillApi(route: Route, method: string, path: string, role: Role | null) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
  if (method === "OPTIONS") {
    return route.fulfill({ status: 204, headers: corsHeaders });
  }
  if (path === "/mock/sample.pdf") {
    return route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/pdf",
      body: fs.readFileSync(path.join(process.cwd(), "tests/e2e/assets/sample.pdf")),
    });
  }

  const json = (body: unknown, status = 200) =>
    route.fulfill({
      status,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  if (path === "/auth/check-setup") {
    return json({ needsSetup: true, allowedDomains: ["student.tdtu.edu.vn", "tdtu.edu.vn"], studentRegistrationAllowed: true });
  }
  if (path === "/auth/user") {
    return role ? json(users[role]) : json({ error: "Unauthorized" }, 401);
  }
  if (path === "/auth/logout") return json({ ok: true });
  if (path === "/auth/google") return json({ redirect: true });

  if (path === "/exam-templates" && method === "GET") return json({ templates: fixtures.templates });
  if (path === "/exam-templates" && method === "POST") return json({ template: { _id: "tpl-created" } }, 201);
  if (path === "/exam-templates/tpl-1" && method === "GET") return json({ template: fixtures.templates[0] });
  if (path === "/exam-templates/tpl-1" && method === "PUT") return json({ template: { ...fixtures.templates[0], templateName: "Updated" } });
  if (path === "/exam-templates/tpl-1" && method === "DELETE") return json({ ok: true });
  if (path === "/exam-templates/tpl-1/share" && method === "POST") return json({ message: "Template shared successfully!" });

  if (path === "/classrooms" && method === "GET") return json({ classrooms: fixtures.classrooms });
  if (path === "/classrooms" && method === "POST") return json({ classroom: { _id: "class-created" } }, 201);
  if (path === "/classrooms/class-1" && method === "GET") return json({ classroom: fixtures.classrooms[0] });
  if (path === "/classrooms/class-1" && method === "PUT") return json({ classroom: fixtures.classrooms[0] });
  if (path === "/classrooms/class-1" && method === "DELETE") return json({ ok: true });

  if (path === "/exam-sessions" && method === "GET") return json({ sessions: fixtures.sessions });
  if (path === "/exam-sessions" && method === "POST") return json({ session: { _id: "session-created", roomCode: "NEW123" } }, 201);
  if (path === "/exam-sessions/session-1" && method === "GET") return json({ session: fixtures.sessions[0] });
  if (path === "/exam-sessions/session-1" && method === "PUT") return json({ session: fixtures.sessions[0] });
  if (path === "/exam-sessions/session-1/start" && method === "POST") return json({ ok: true });
  if (path === "/exam-sessions/session-1/end" && method === "POST") return json({ ok: true });
  if (path === "/exam-sessions/session-1/students") return json({
    students: [
      {
        _id: "joined-1",
        computerOrder: 12,
        isApproved: true,
        isSubmitted: false,
        student: {
          _id: "student-1",
          name: "Nguyen Van An",
          email: "521H0001@student.tdtu.edu.vn",
          studentId: "521H0001",
          avatar: "",
        },
      },
    ],
  });
  if (path === "/exam-sessions/session-1/waiting") return json({
    waitingStudents: [
      {
        _id: "student-2",
        name: "Le Thi Binh",
        email: "522H0002@student.tdtu.edu.vn",
        computerOrder: 13,
      },
    ],
  });
  if (path === "/exam-sessions/session-1/approve-waiting/student-2" && method === "POST") return json({ ok: true });
  if (path === "/exam-sessions/session-1/approve-all-waiting" && method === "POST") return json({ ok: true });
  if (path === "/exam-sessions/session-1/results") return json({ results: [] });
  if (path === "/exam-sessions/session-1/exam") return json(fixtures.exam);
  if (path === "/exam-sessions/session-1/status") return json({ status: "ongoing" });
  if (path === "/exam-sessions/available" && method === "GET") return json({ sessions: fixtures.sessions });
  if (path === "/exam-sessions/search/by-roomcode/ROOM101") return json({ session: fixtures.sessions[0] });
  if (path === "/exam-sessions/search/by-roomcode/MISSING") return json({ error: "Exam not found" }, 404);
  if (path === "/exam-sessions/join-waiting/ROOM101" && method === "POST") return json({ directEntry: false, sessionId: "session-1" });

  if (path === "/admin/stats") return json({ users: [{ _id: "student", count: 20 }, { _id: "lecturer", count: 3, activeCount: 3 }, { _id: "admin", count: 1, activeCount: 1 }], recentLogins: 7 });
  if (path.startsWith("/admin/users") && method === "GET") return json({ users: adminUsers(), pagination: { page: path.includes("page=2") ? 2 : 1, pages: 2, total: 18 } });
  if (path === "/admin/users" && method === "POST") return json({ user: { _id: "new-user" } }, 201);
  if (/^\/admin\/users\/[^/]+$/.test(path) && method === "PUT") return json({ ok: true });
  if (/^\/admin\/users\/[^/]+$/.test(path) && method === "DELETE") return json({ ok: true });
  if (path === "/admin/settings" && method === "GET") return json({ systemName: "DERIT", allowStudentRegistration: true, allowedStudentDomains: ["student.tdtu.edu.vn"], defaultCompileTimeout: 10000, defaultRunTimeout: 5000, maxConcurrentSubmissions: 4 });
  if (path === "/admin/settings" && method === "PUT") return json({ ok: true });
  if (path.startsWith("/admin/logs/stats")) return json({ stats: [{ _id: "login", count: 10 }, { _id: "admin_create_user", count: 2 }] });
  if (path.startsWith("/admin/logs")) return json({ logs: [{ _id: "log-1", activityType: "login", timestamp: "2026-07-25T01:00:00.000Z", ipAddress: "127.0.0.1", userId: { name: "Super Admin", email: "admin@tdtu.edu.vn" } }], pagination: { page: 1, pages: 2, total: 21 } });

  if (path === "/submissions/session/session-1/all") return json({
    submissions: [
      {
        _id: "row-1",
        student: { _id: "student-1", name: "Nguyen Van An", email: "521H0001@student.tdtu.edu.vn" },
        studentId: { _id: "student-1", name: "Nguyen Van An", email: "521H0001@student.tdtu.edu.vn" },
        examCodeNumber: "A",
        isSubmitted: true,
        tabSwitchCount: 1,
        finalScore: 10,
        maxPossibleScore: 10,
        submissions: [
          {
            questionNumber: 1,
            score: 10,
            maxScore: 10,
            files: [{ name: "Main.java", content: "public class Main {}" }],
            testResults: [{ status: "passed", input: "1 2", expectedOutput: "3", actualOutput: "3" }],
          },
        ],
      },
      {
        _id: "row-2",
        student: { _id: "student-2", name: "Le Thi Binh", email: "522H0002@student.tdtu.edu.vn" },
        studentId: { _id: "student-2", name: "Le Thi Binh", email: "522H0002@student.tdtu.edu.vn" },
        examCodeNumber: "B",
        isSubmitted: false,
        tabSwitchCount: 0,
        finalScore: 0,
        maxPossibleScore: 10,
        submissions: [],
      },
    ],
  });
  if (path === "/submissions/exam/session-1") return json({
    submission: {
      _id: "submission-1",
      examCodeNumber: "A",
      computerOrder: 12,
      submissions: [],
    },
  });
  if (path === "/submissions/autosave" && method === "POST") return json({ ok: true });
  if (path === "/submissions" && method === "POST") return json({ submissionId: "submission-1" }, 201);
  if (path === "/submissions/run-console" && method === "POST") return json({ stdout: "3\n", stderr: "", executionTime: 10 });
  if (path === "/submissions/submit-exam/session-1" && method === "POST") return json({ ok: true });
  if (path === "/submissions/record-activity/session-1" && method === "POST") return json({ ok: true });
  if (path === "/submissions/record-client-event/session-1" && method === "POST") return json({ ok: true });
  if (path === "/submissions/session/session-1/regrade-all" && method === "POST") return json({ total: 1 });
  if (path === "/submissions/session/session-1/export-csv") return route.fulfill({ status: 200, headers: corsHeaders, contentType: "text/csv", body: "name,score\nNguyen Van An,10\n" });
  if (path === "/submissions/session/session-1/student/student-1/detail") return json({
    submission: {
      _id: "submission-1",
      student: { _id: "student-1", name: "Nguyen Van An", email: "521H0001@student.tdtu.edu.vn" },
      examCodeNumber: "A",
      language: "java",
      submissions: [
        {
          questionNumber: 1,
          status: "accepted",
          score: 10,
          maxScore: 10,
          files: [{ name: "Main.java", content: "public class Main {}" }],
          testResults: [{ status: "accepted", input: "1 2", expectedOutput: "3", actualOutput: "3" }],
        },
      ],
    },
  });
  if (path === "/submissions/session/session-1/student/student-1/activity") return json({
    activities: [
      { _id: "act-1", type: "join", timestamp: "2026-07-25T02:00:00.000Z" },
      { _id: "act-2", type: "tab_switch", timestamp: "2026-07-25T02:05:00.000Z" },
    ],
    summary: { joins: 1, tabSwitches: 1 },
  });
  if (path === "/results/session/session-1") return json({ results: [] });
  if (path === "/results/session/session-1/leaderboard") return json({ leaderboard: [] });
  if (path === "/results/session/session-1/finalize" && method === "POST") return json({ ok: true });

  if (path === "/upload/pdf" && method === "POST") return json({ url: "/uploads/sample.pdf" }, 201);

  if (path === "/results/history") return json({ results: [] });

  return json({ error: `Unhandled mock ${method} ${path}` }, 500);
}

function adminUsers() {
  return [
    { _id: "admin-1", name: "Super Admin", email: "admin@tdtu.edu.vn", role: "admin", isActive: true, isSuperAdmin: true, lastLogin: "2026-07-25T01:00:00.000Z" },
    { _id: "lecturer-1", name: "Dr. Tran Minh", email: "lecturer@tdtu.edu.vn", role: "lecturer", isActive: true, lastLogin: null },
    { _id: "student-1", name: "Nguyen Van An", email: "521H0001@student.tdtu.edu.vn", role: "student", studentId: "521H0001", isActive: false, lastLogin: null },
  ];
}
