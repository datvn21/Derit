import { test, expect, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const apiBase = "http://localhost:5001";

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

const serverEnv = readEnvFile(path.join(repoRoot, "apps/server/.env"));
for (const [key, value] of Object.entries(serverEnv)) {
  process.env[key] = value;
}

async function seedRealBackend(request: APIRequestContext) {
  test.skip(
    process.env.E2E_ALLOW_DB_MUTATION !== "true",
    "Set E2E_ALLOW_DB_MUTATION=true in apps/server/.env and use an isolated E2E database to run real CRUD flows.",
  );
  const response = await request.post(`${apiBase}/__e2e/seed`);
  await expect(response).toBeOK();
  return response.json();
}

async function loginAs(request: APIRequestContext, role: "lecturer" | "admin") {
  const response = await request.get(`${apiBase}/__e2e/login/${role}`);
  await expect(response).toBeOK();
}

const sampleExamCodes = [
  {
    codeNumber: "1",
    pdfUrl: "/uploads/e2e-sample.pdf",
    questions: [
      {
        questionNumber: 1,
        title: "CRUD sum",
        starterFiles: [
          {
            name: "Main.java",
            content:
              "import java.util.*; public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); System.out.println(sc.nextInt() + sc.nextInt()); } }",
          },
        ],
        defaultMainFile: "Main.java",
        testCases: [{ input: "2 3", expectedOutput: "5", isHidden: false }],
      },
    ],
  },
];

test.describe("Real backend CRUD", () => {
  test("performs lecturer classroom CRUD against the real backend", async ({ request }) => {
    await seedRealBackend(request);
    await loginAs(request, "lecturer");

    const create = await request.post(`${apiBase}/classrooms`, {
      data: {
        classroomName: "E2E CRUD Classroom Unicode Kỳ Thi",
        students: ["crud.student01", " crud.student02 ", "", "crud.student03"],
      },
    });
    await expect(create).toBeOK();
    const created = (await create.json()).classroom;
    expect(created.classroomName).toBe("E2E CRUD Classroom Unicode Kỳ Thi");
    expect(created.students).toEqual(["crud.student01", "crud.student02", "crud.student03"]);

    const read = await request.get(`${apiBase}/classrooms/${created._id}`);
    await expect(read).toBeOK();
    await expect(await read.json()).toEqual(
      expect.objectContaining({
        classroom: expect.objectContaining({ _id: created._id }),
      }),
    );

    const update = await request.put(`${apiBase}/classrooms/${created._id}`, {
      data: {
        classroomName: "E2E CRUD Classroom Updated",
        students: ["updated.student"],
      },
    });
    await expect(update).toBeOK();
    const updated = (await update.json()).classroom;
    expect(updated.classroomName).toBe("E2E CRUD Classroom Updated");
    expect(updated.students).toEqual(["updated.student"]);

    const list = await request.get(`${apiBase}/classrooms`);
    await expect(list).toBeOK();
    expect((await list.json()).classrooms.some((c: any) => c._id === created._id)).toBe(true);

    const remove = await request.delete(`${apiBase}/classrooms/${created._id}`);
    await expect(remove).toBeOK();
    expect((await request.get(`${apiBase}/classrooms/${created._id}`)).status()).toBe(404);
  });

  test("performs lecturer exam template CRUD against the real backend", async ({ request }) => {
    await seedRealBackend(request);
    await loginAs(request, "lecturer");

    const create = await request.post(`${apiBase}/exam-templates`, {
      data: {
        templateName: "E2E CRUD Template Java",
        examType: "OOP",
        language: "java",
        duration: 45,
        examCodes: sampleExamCodes,
      },
    });
    await expect(create).toBeOK();
    const created = (await create.json()).template;
    expect(created.templateName).toBe("E2E CRUD Template Java");
    expect(created.language).toBe("java");

    const read = await request.get(`${apiBase}/exam-templates/${created._id}`);
    await expect(read).toBeOK();
    expect((await read.json()).template.examCodes[0].questions[0].title).toBe("CRUD sum");

    const update = await request.put(`${apiBase}/exam-templates/${created._id}`, {
      data: {
        templateName: "E2E CRUD Template Java Updated",
        duration: 60,
      },
    });
    await expect(update).toBeOK();
    const updated = (await update.json()).template;
    expect(updated.templateName).toBe("E2E CRUD Template Java Updated");
    expect(updated.duration).toBe(60);

    const publish = await request.patch(`${apiBase}/exam-templates/${created._id}/publish`);
    await expect(publish).toBeOK();
    expect(typeof (await publish.json()).template.isPublished).toBe("boolean");

    const remove = await request.delete(`${apiBase}/exam-templates/${created._id}`);
    await expect(remove).toBeOK();
    expect((await request.get(`${apiBase}/exam-templates/${created._id}`)).status()).toBe(404);
  });

  test("performs lecturer exam session CRUD against the real backend", async ({ request }) => {
    await seedRealBackend(request);
    await loginAs(request, "lecturer");

    const templateCreate = await request.post(`${apiBase}/exam-templates`, {
      data: {
        templateName: "E2E CRUD Session Template",
        examType: "OOP",
        language: "java",
        duration: 30,
        examCodes: sampleExamCodes,
      },
    });
    await expect(templateCreate).toBeOK();
    const template = (await templateCreate.json()).template;

    const startTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const create = await request.post(`${apiBase}/exam-sessions`, {
      data: {
        examTemplateId: template._id,
        sessionName: "E2E CRUD Scheduled Session",
        accessKey: "CRUDKEY",
        whitelist: ["crud.student01"],
        blacklist: ["blocked.student"],
        startTime,
        endTime,
        entryMode: "approval",
      },
    });
    await expect(create).toBeOK();
    const created = (await create.json()).session;
    expect(created.sessionName).toBe("E2E CRUD Scheduled Session");
    expect(created.status).toBe("scheduled");
    expect(created.roomCode).toBeTruthy();

    const read = await request.get(`${apiBase}/exam-sessions/${created._id}`);
    await expect(read).toBeOK();
    expect((await read.json()).session.accessKey).toBe("CRUDKEY");

    const update = await request.put(`${apiBase}/exam-sessions/${created._id}`, {
      data: {
        sessionName: "E2E CRUD Scheduled Session Updated",
        accessKey: "CRUDKEY2",
        whitelist: ["crud.student02@student.tdtu.edu.vn"],
        blacklist: [],
      },
    });
    await expect(update).toBeOK();
    const updated = (await update.json()).session;
    expect(updated.sessionName).toBe("E2E CRUD Scheduled Session Updated");
    expect(updated.accessKey).toBe("CRUDKEY2");
    expect(updated.whitelist).toContain("crud.student02@student.tdtu.edu.vn");

    const list = await request.get(`${apiBase}/exam-sessions`);
    await expect(list).toBeOK();
    expect((await list.json()).sessions.some((s: any) => s._id === created._id)).toBe(true);

    const remove = await request.delete(`${apiBase}/exam-sessions/${created._id}`);
    await expect(remove).toBeOK();
    expect((await request.get(`${apiBase}/exam-sessions/${created._id}`)).status()).toBe(404);

    await expect(await request.delete(`${apiBase}/exam-templates/${template._id}`)).toBeOK();
  });

  test("performs admin user CRUD against the real backend", async ({ request }) => {
    await seedRealBackend(request);
    await loginAs(request, "admin");

    const unique = Date.now();
    const email = `e2e.crud.${unique}@tdtu.edu.vn`;
    const create = await request.post(`${apiBase}/admin/users`, {
      data: {
        email,
        name: "E2E CRUD Lecturer",
        role: "lecturer",
      },
    });
    await expect(create).toBeOK();
    const created = await create.json();
    expect(created.email).toBe(email);
    expect(created.role).toBe("lecturer");

    const read = await request.get(`${apiBase}/admin/users/${created.id}`);
    await expect(read).toBeOK();
    expect((await read.json()).name).toBe("E2E CRUD Lecturer");

    const update = await request.put(`${apiBase}/admin/users/${created.id}`, {
      data: {
        name: "E2E CRUD Lecturer Updated",
        role: "lecturer",
        isActive: false,
      },
    });
    await expect(update).toBeOK();
    const updated = await update.json();
    expect(updated.name).toBe("E2E CRUD Lecturer Updated");
    expect(updated.isActive).toBe(false);

    const list = await request.get(`${apiBase}/admin/users?search=${encodeURIComponent(email)}`);
    await expect(list).toBeOK();
    expect((await list.json()).users.some((u: any) => u.email === email)).toBe(true);

    const remove = await request.delete(`${apiBase}/admin/users/${created.id}`);
    await expect(remove).toBeOK();
    expect((await request.get(`${apiBase}/admin/users/${created.id}`)).status()).toBe(404);
  });
});
