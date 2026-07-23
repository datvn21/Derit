import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Login page
  index("routes/Login.tsx"),
  // Student routes
  route("student", "routes/student/Dashboard.tsx"),
  route("student/history", "routes/student/History.tsx"),
  route("student/history/:sessionId", "routes/student/HistoryDetail.tsx"),
  route("student/exam/:sessionId", "routes/student/Exam/$sessionId.tsx"),
  // Lecturer routes
  layout("components/Layout.tsx", [
    route("lecturer", "routes/lecturer/Dashboard.tsx"),
    route("lecturer/exam-templates", "routes/lecturer/exam-template/ExamTemplateList.tsx"),
    route("lecturer/exam-templates/create", "routes/lecturer/exam-template/ExamTemplateCreate.tsx"),
    route("lecturer/exam-templates/:id/edit", "routes/lecturer/exam-template/ExamTemplateEdit.tsx"),
    route("lecturer/exam-sessions", "routes/lecturer/exam-session/ExamSessionList.tsx"),
    route("lecturer/exam-sessions/create", "routes/lecturer/exam-session/ExamSessionCreate.tsx"),
    route("lecturer/exam-sessions/:id", "routes/lecturer/exam-session/ExamSessionDetail.tsx"),
    route("lecturer/exam-sessions/:id/results", "routes/lecturer/exam-session/ExamSessionResults.tsx"),
    route("lecturer/classrooms", "routes/lecturer/classroom/ClassroomList.tsx"),
    route("lecturer/classrooms/create", "routes/lecturer/classroom/ClassroomCreate.tsx"),
    route("lecturer/classrooms/:id/edit", "routes/lecturer/classroom/ClassroomEdit.tsx"),
  ]),
  // Admin routes
  layout("routes/admin/Layout.tsx", [
    route("admin", "routes/admin/Dashboard.tsx"),
    route("admin/users", "routes/admin/Users.tsx"),
    route("admin/logs", "routes/admin/Logs.tsx"),
    route("admin/settings", "routes/admin/Settings.tsx"),
    route("admin/setup", "routes/admin/Setup.tsx"),
  ]),
] satisfies RouteConfig;

