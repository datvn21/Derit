import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import UserModel from "../models/User.js";
import AdminSettingsModel from "../models/AdminSettings.js";
import ExamTemplateModel from "../models/ExamTemplate.js";
import ExamSessionModel from "../models/ExamSession.js";
import StudentExamCodeModel from "../models/StudentExamCode.js";
import StudentSubmissionModel from "../models/StudentSubmission.js";
import ClassroomModel from "../models/Classroom.js";
import ActivityLogModel from "../models/ActivityLog.js";
import ResultModel from "../models/Result.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureEnabled(req, res, next) {
  if (process.env.E2E_TEST_MODE !== "true") {
    return res.status(404).json({ error: "Not found" });
  }
  next();
}

router.use(ensureEnabled);

const users = {
  admin: {
    googleId: "e2e-admin",
    email: "e2e.admin@tdtu.edu.vn",
    name: "E2E Admin",
    role: "admin",
    isSuperAdmin: true,
    isActive: true,
  },
  lecturer: {
    googleId: "e2e-lecturer",
    email: "e2e.lecturer@tdtu.edu.vn",
    name: "E2E Lecturer",
    role: "lecturer",
    isActive: true,
  },
  student: {
    googleId: "e2e-student",
    email: "e2e.student@student.tdtu.edu.vn",
    name: "E2E Student",
    role: "student",
    studentId: "e2e.student",
    isActive: true,
  },
  waitingStudent: {
    googleId: "e2e-waiting-student",
    email: "e2e.waiting@student.tdtu.edu.vn",
    name: "E2E Waiting Student",
    role: "student",
    studentId: "e2e.waiting",
    isActive: true,
  },
};

async function writeSamplePdf() {
  const uploadsDir = path.join(__dirname, "../../uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(
    path.join(uploadsDir, "e2e-sample.pdf"),
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  );
}

router.post("/seed", async (_req, res) => {
  if (process.env.E2E_ALLOW_DB_MUTATION !== "true") {
    return res.status(403).json({
      error: "E2E_ALLOW_DB_MUTATION=true is required before seeding test data",
    });
  }

  const e2eUsers = await UserModel.find({ googleId: /^e2e-/ }).select("_id");
  const e2eUserIds = e2eUsers.map((user) => user._id);

  const e2eSessions = await ExamSessionModel.find({ roomCode: /^E2E/ }).select("_id");
  const e2eSessionIds = e2eSessions.map((session) => session._id);

  await Promise.all([
    ActivityLogModel.deleteMany({ userId: { $in: e2eUserIds } }),
    ResultModel.deleteMany({ studentId: { $in: e2eUserIds } }),
    StudentSubmissionModel.deleteMany({
      $or: [{ studentId: { $in: e2eUserIds } }, { examSessionId: { $in: e2eSessionIds } }],
    }),
    StudentExamCodeModel.deleteMany({
      $or: [{ studentId: { $in: e2eUserIds } }, { examSessionId: { $in: e2eSessionIds } }],
    }),
    ExamSessionModel.deleteMany({ roomCode: /^E2E/ }),
    ExamTemplateModel.deleteMany({ templateName: /^E2E / }),
    ClassroomModel.deleteMany({ classroomName: /^E2E / }),
    UserModel.deleteMany({ googleId: /^e2e-/ }),
  ]);

  const [admin, lecturer, student, waitingStudent] = await Promise.all([
    UserModel.create(users.admin),
    UserModel.create(users.lecturer),
    UserModel.create(users.student),
    UserModel.create(users.waitingStudent),
  ]);

  await AdminSettingsModel.updateSettings({
    allowStudentRegistration: true,
    allowedStudentDomains: ["student.tdtu.edu.vn"],
  });

  await writeSamplePdf();

  const classroom = await ClassroomModel.create({
    classroomName: "E2E Classroom",
    students: ["e2e.student"],
    createdBy: lecturer._id,
  });

  const template = await ExamTemplateModel.create({
    templateName: "E2E Java Arrays Final",
    examType: "OOP",
    language: "java",
    duration: 90,
    createdBy: lecturer._id,
    isPublished: true,
    examCodes: [
      {
        codeNumber: "1",
        pdfUrl: "/uploads/e2e-sample.pdf",
        questions: [
          {
            questionNumber: 1,
            title: "Sum two numbers",
            starterFiles: [
              {
                name: "Main.java",
                content:
                  "import java.util.*; public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); int a = sc.nextInt(); int b = sc.nextInt(); System.out.println(a + b); } }",
              },
            ],
            defaultMainFile: "Main.java",
            testCases: [
              {
                input: "1 2",
                expectedOutput: "3",
                isHidden: false,
                testFile: {
                  name: "Test1.java",
                  content: "public class Test1 { public static void main(String[] args) { Main.main(args); } }",
                },
              },
            ],
          },
          {
            questionNumber: 2,
            title: "Print a marker",
            starterFiles: [
              {
                name: "Main.java",
                content:
                  'public class Main { public static void main(String[] args) { System.out.println("q2"); } }',
              },
            ],
            defaultMainFile: "Main.java",
            testCases: [
              {
                input: "",
                expectedOutput: "q2",
                isHidden: false,
                testFile: {
                  name: "TestQ2.java",
                  content: "public class TestQ2 { public static void main(String[] args) { Main.main(args); } }",
                },
              },
            ],
          },
        ],
      },
    ],
  });

  const session = await ExamSessionModel.create({
    examTemplateId: template._id,
    sessionName: "E2E Java Midterm Room 101",
    roomCode: "E2E101",
    accessKey: "SECRET",
    whitelist: [student.email],
    blacklist: [],
    waitingList: [{ userId: waitingStudent._id, computerOrder: 31 }],
    entryMode: "open",
    classroomIds: [classroom._id],
    startTime: new Date(Date.now() - 15 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: "ongoing",
    createdBy: lecturer._id,
  });

  await StudentExamCodeModel.create({
    examSessionId: session._id,
    studentId: student._id,
    examCodeNumber: "1",
    computerOrder: 12,
  });

  const pythonTemplate = await ExamTemplateModel.create({
    templateName: "E2E Python Warmup",
    examType: "DSA",
    language: "python",
    duration: 90,
    createdBy: lecturer._id,
    isPublished: true,
    examCodes: [
      {
        codeNumber: "1",
        pdfUrl: "/uploads/e2e-sample.pdf",
        questions: [
          {
            questionNumber: 1,
            title: "Sum numbers with Python",
            starterFiles: [
              {
                name: "main.py",
                content: "import sys\nnums=list(map(int, sys.stdin.read().split()))\nprint(sum(nums))\n",
              },
            ],
            defaultMainFile: "main.py",
            testCases: [
              {
                input: "4 5",
                expectedOutput: "9",
                isHidden: false,
                testFile: {
                  name: "test_runner.py",
                  content:
                    "import runpy\nrunpy.run_path('main.py', run_name='__main__')\n",
                },
              },
            ],
          },
        ],
      },
    ],
  });

  const pythonSession = await ExamSessionModel.create({
    examTemplateId: pythonTemplate._id,
    sessionName: "E2E Python Lab Room 202",
    roomCode: "E2E202",
    accessKey: "PYSECRET",
    whitelist: [student.email],
    blacklist: [],
    waitingList: [],
    entryMode: "open",
    classroomIds: [classroom._id],
    startTime: new Date(Date.now() - 15 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: "ongoing",
    createdBy: lecturer._id,
  });

  await StudentExamCodeModel.create({
    examSessionId: pythonSession._id,
    studentId: student._id,
    examCodeNumber: "1",
    computerOrder: 22,
  });

  res.json({
    ok: true,
    users: {
      admin: admin._id,
      lecturer: lecturer._id,
      student: student._id,
      waitingStudent: waitingStudent._id,
    },
    templateId: template._id,
    sessionId: session._id,
    roomCode: session.roomCode,
    pythonTemplateId: pythonTemplate._id,
    pythonSessionId: pythonSession._id,
    pythonRoomCode: pythonSession.roomCode,
  });
});

router.get("/login/:role", async (req, res, next) => {
  const fixture = users[req.params.role];
  if (!fixture) return res.status(400).json({ error: "Unknown role" });

  const user = await UserModel.findOne({ googleId: fixture.googleId });
  if (!user) return res.status(404).json({ error: "Seed user not found" });

  req.login({ id: user.googleId, email: user.email }, (err) => {
    if (err) return next(err);
    res.json({ ok: true, role: user.role, email: user.email });
  });
});

export default router;
