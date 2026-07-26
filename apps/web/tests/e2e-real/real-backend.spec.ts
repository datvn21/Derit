import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");

function readEnvFile(filePath: string) {
  const env: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const serverEnvPath = path.join(repoRoot, "apps/server/.env");
const serverEnv = readEnvFile(serverEnvPath);
for (const [key, value] of Object.entries(serverEnv)) {
  process.env[key] = value;
}

async function executeCodeLocally(...args: any[]) {
  const mod = await import("../../../server/src/services/codeExecutor.js");
  return mod.executeCodeLocally(...args);
}

async function seedRealBackend(request: import("@playwright/test").APIRequestContext) {
  test.skip(
    process.env.E2E_ALLOW_DB_MUTATION !== "true",
    "Set E2E_ALLOW_DB_MUTATION=true in apps/server/.env and use an isolated E2E database to run seeded real-backend UI flows.",
  );
  const response = await request.post("http://localhost:5001/__e2e/seed");
  await expect(response).toBeOK();
  return response.json();
}

async function loginAs(page: import("@playwright/test").Page, role: "student" | "lecturer" | "admin") {
  const response = await page.request.get(`http://localhost:5001/__e2e/login/${role}`);
  await expect(response).toBeOK();
}

async function joinExamFromDashboard(
  page: import("@playwright/test").Page,
  {
    roomCode,
    accessKey,
    sessionName,
    heading,
    computerOrder,
  }: {
    roomCode: string;
    accessKey: string;
    sessionName: string;
    heading: string;
    computerOrder: string;
  },
) {
  await page.goto("/student");
  await expect(page.getByRole("heading", { name: /Welcome, E2E Student/i })).toBeVisible();
  await expect(page.getByText(sessionName)).toBeVisible();
  await page.getByPlaceholder("Enter room code").fill(roomCode);
  await page.getByRole("button", { name: /Search/i }).click();
  await expect(page.getByRole("dialog")).toContainText(sessionName);
  await page.getByLabel("Access Key").fill(accessKey);
  const computerOrderInput = page.getByLabel("Computer Order");
  if (await computerOrderInput.isVisible()) {
    await computerOrderInput.fill(computerOrder);
  }
  await page.getByRole("button", { name: "Join Exam" }).click();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Files")).toBeVisible();
  await expect(page.getByText("Test Cases")).toBeVisible();
}

async function replaceEditorContent(page: import("@playwright/test").Page, code: string) {
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.insertText(code);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
}

test.describe("Real backend smoke", () => {
  test("validates local env contract without printing secrets", async () => {
    const webEnv = readEnvFile(path.join(repoRoot, "apps/web/.env"));

    expect(serverEnv.FRONTEND_URL).toBe("http://localhost:5173");
    expect(serverEnv.CALLBACK_URL).toBe("http://localhost:5001/auth/google/callback");
    expect(serverEnv.NSJAIL_PATH).toBeTruthy();
    expect(serverEnv.JAVA_HOME).toBeTruthy();
    expect(serverEnv.PYTHON_BIN).toBeTruthy();
    expect(serverEnv.NSJAIL_DISABLE_NEWNS).toBe("true");
    expect(webEnv.VITE_DEV_BACKEND_URL).toBe("http://localhost:5001");
  });

  test("serves real backend health and public auth setup endpoints", async ({ request }) => {
    const root = await request.get("http://localhost:5001/");
    await expect(root).toBeOK();
    await expect(await root.text()).toMatch(/Hello from DERIT API/);

    const setup = await request.get("http://localhost:5001/auth/check-setup");
    await expect(setup).toBeOK();
    const body = await setup.json();
    expect(body).toEqual(
      expect.objectContaining({
        needsSetup: expect.any(Boolean),
        allowedDomains: expect.any(Array),
      }),
    );

    const user = await request.get("http://localhost:5001/auth/user");
    expect(user.status()).toBe(401);
  });

  test("supports real seeded auth sessions for student, lecturer, and admin", async ({ page, request }) => {
    await seedRealBackend(request);

    await loginAs(page, "student");
    await page.goto("/student");
    await expect(page.getByRole("heading", { name: /Welcome, E2E Student/i })).toBeVisible();

    await loginAs(page, "lecturer");
    await page.goto("/lecturer/exam-templates");
    await expect(page.getByRole("heading", { name: "Exam Templates" })).toBeVisible();
    await expect(page.getByText("E2E Java Arrays Final")).toBeVisible();

    await loginAs(page, "admin");
    await page.goto("/admin/users");
    await expect(page.getByRole("table")).toContainText("E2E Admin");
  });

  test("covers real student dashboard, exam workspace, nsjail run, autosave, submit, and history", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "student");

    await joinExamFromDashboard(page, {
      roomCode: "E2E101",
      accessKey: "SECRET",
      sessionName: "E2E Java Midterm Room 101",
      heading: "E2E Java Arrays Final",
      computerOrder: "12",
    });
    await expect(page.getByText(/E2E Student/i)).toBeVisible();
    await replaceEditorContent(
      page,
      "public class Main { public static void main(String[] args) { System.out.println(3); } }",
    );
    await page.getByRole("button", { name: /Run/i }).click();
    await expect(page.locator("pre").filter({ hasText: "3" })).toBeVisible({ timeout: 30000 });

    await replaceEditorContent(
      page,
      'import java.util.*; public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); int a = sc.nextInt(); int b = sc.nextInt(); System.out.println(a + b); } }',
    );
    await page.getByRole("button", { name: "Chạy test case này" }).click();
    await expect(page.getByText("Passed 1/1")).toBeVisible({ timeout: 30000 });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Exam submitted successfully!")).toBeVisible();
    await expect(page).toHaveURL(/\/student$/);

    await page.getByRole("link", { name: /History/i }).click();
    await expect(page.getByRole("heading", { name: /My History/i })).toBeVisible();
  });

  test("visually runs Java in the real exam UI through nsjail", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "student");

    await joinExamFromDashboard(page, {
      roomCode: "E2E101",
      accessKey: "SECRET",
      sessionName: "E2E Java Midterm Room 101",
      heading: "E2E Java Arrays Final",
      computerOrder: "12",
    });

    await replaceEditorContent(
      page,
      "public class Main { public static void main(String[] args) { System.out.println(\"java-ui-nsjail\"); } }",
    );
    await page.getByRole("button", { name: /Run/i }).click();
    await expect(page.locator("pre").filter({ hasText: "java-ui-nsjail" })).toBeVisible({ timeout: 30000 });

    await replaceEditorContent(
      page,
      'import java.util.*; public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); int a = sc.nextInt(); int b = sc.nextInt(); System.out.println(a + b); } }',
    );
    await page.getByRole("button", { name: "Chạy test case này" }).click();
    await expect(page.getByText("Passed 1/1")).toBeVisible({ timeout: 30000 });
  });

  test("visually runs Python in the real exam UI through nsjail", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "student");

    await joinExamFromDashboard(page, {
      roomCode: "E2E202",
      accessKey: "PYSECRET",
      sessionName: "E2E Python Lab Room 202",
      heading: "E2E Python Warmup",
      computerOrder: "22",
    });

    await replaceEditorContent(page, "print('python-ui-nsjail')\n");
    await page.getByRole("button", { name: /Run/i }).click();
    await expect(page.locator("pre").filter({ hasText: "python-ui-nsjail" })).toBeVisible({ timeout: 30000 });

    await replaceEditorContent(
      page,
      "import sys\nnums=list(map(int, sys.stdin.read().split()))\nprint(sum(nums))\n",
    );
    await page.getByRole("button", { name: "Chạy test case này" }).click();
    await expect(page.getByText("Passed 1/1")).toBeVisible({ timeout: 30000 });
  });

  test("covers real lecturer template/session/results management", async ({ page, request }) => {
    const seeded = await seedRealBackend(request);
    await loginAs(page, "lecturer");

    await page.goto("/lecturer/exam-templates");
    await expect(page.getByText("E2E Java Arrays Final")).toBeVisible();
    await page.getByPlaceholder("Search templates...").fill("E2E");
    await expect(page.getByText("E2E Java Arrays Final")).toBeVisible();

    await page.goto("/lecturer/exam-sessions");
    await expect(page.getByText("E2E Java Midterm Room 101")).toBeVisible();
    await page.getByPlaceholder("Search sessions...").fill("E2E101");
    await expect(page.getByText("E2E Java Midterm Room 101")).toBeVisible();

    await page.locator("div").filter({ hasText: "E2E Java Midterm Room 101" }).filter({ hasText: "E2E101" }).first()
      .getByRole("button", { name: "Details" }).click();
    await expect(page.getByRole("heading", { name: "E2E Java Midterm Room 101" })).toBeVisible();
    await page.goto(`/lecturer/exam-sessions/${seeded.sessionId}/results`);
    await expect(page.getByRole("heading", { name: "E2E Java Midterm Room 101" })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    await downloadPromise;
  });

  test("covers real admin users, logs, and settings surfaces", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "admin");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    await page.goto("/admin/users");
    await expect(page.getByRole("table")).toContainText("E2E Student");
    await page.getByPlaceholder(/Search by name/i).fill("E2E");
    await expect(page.getByRole("table")).toContainText("E2E Lecturer");

    await page.goto("/admin/logs");
    await expect(page.getByRole("heading", { name: "Activity Logs" })).toBeVisible();

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();
    await page.getByLabel("System Name").fill("DERIT E2E");
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();
  });

  test("renders frontend against the real backend and exposes Google OAuth redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "DERIT" })).toBeVisible();

    const responsePromise = page.waitForResponse("http://localhost:5001/auth/check-setup");
    await page.reload();
    await expect(responsePromise).resolves.toBeTruthy();

    const oauth = await page.request.get("http://localhost:5001/auth/google", {
      maxRedirects: 0,
    });
    expect(oauth.status()).toBe(302);
    expect(oauth.headers().location).toContain("accounts.google.com");
  });

  test("runs Java code through the real nsjail executor", async () => {
    const result = await executeCodeLocally(
      {
        language: "java",
        mainFile: "Main.java",
        files: [
          {
            name: "Main.java",
            content:
              'import java.util.*; public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); int a = sc.nextInt(); int b = sc.nextInt(); System.out.println(a + b); } }',
          },
        ],
      },
      [{ input: "1 2", expectedOutput: "3" }],
    );

    expect(result.status).toBe("accepted");
    expect(result.passedCount).toBe(1);
    expect(result.results[0].output).toBe("3\n");
  });

  test("runs Python code through the real nsjail executor", async () => {
    const result = await executeCodeLocally(
      {
        language: "python",
        mainFile: "main.py",
        files: [
          {
            name: "main.py",
            content: "import sys\nnums=list(map(int, sys.stdin.read().split()))\nprint(sum(nums))\n",
          },
        ],
      },
      [{ input: "1 2", expectedOutput: "3" }],
    );

    expect(result.status).toBe("accepted");
    expect(result.passedCount).toBe(1);
    expect(result.results[0].output).toBe("3\n");
  });
});
