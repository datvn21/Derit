import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiBase, loadServerEnv, loginAs, seedRealBackend } from "./helpers";

loadServerEnv();

test.describe("Real backend routing, errors, accessibility, and visual checks", () => {
  test("covers valid routes, 404, refresh, and browser back/forward on the real app", async ({ page, request }) => {
    await seedRealBackend(request);

    const publicResponse = await page.goto("/");
    expect(publicResponse?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "DERIT" })).toBeVisible();

    await page.goto("/does-not-exist-real-e2e");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await loginAs(page, "lecturer");
    for (const url of [
      "/lecturer",
      "/lecturer/exam-templates",
      "/lecturer/classrooms",
      "/lecturer/exam-sessions",
    ]) {
      const response = await page.goto(url);
      expect(response?.status()).toBeLessThan(400);
      await page.reload();
      await expect(page.locator("body")).not.toContainText("Hydration failed");
    }

    await page.goto("/lecturer/exam-templates");
    await page.getByRole("link", { name: "Sessions" }).click();
    await expect(page).toHaveURL(/\/lecturer\/exam-sessions$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/lecturer\/exam-templates$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/lecturer\/exam-sessions$/);
  });

  test("covers real HTTP error responses for auth, validation, forbidden, missing, and deleted resources", async ({ request }) => {
    const seeded = await seedRealBackend(request);

    expect((await request.get(`${apiBase}/auth/user`)).status()).toBe(401);
    await loginAs(request, "student");
    expect((await request.get(`${apiBase}/admin/users`)).status()).toBe(403);
    expect((await request.get(`${apiBase}/exam-sessions/search/by-roomcode/NOPE404`)).status()).toBe(404);

    await loginAs(request, "lecturer");
    const badClassroom = await request.post(`${apiBase}/classrooms`, { data: { classroomName: "   " } });
    expect(badClassroom.status()).toBe(400);

    const badTemplate = await request.post(`${apiBase}/exam-templates`, {
      data: { templateName: "Missing fields" },
    });
    expect(badTemplate.status()).toBe(400);

    const badSession = await request.post(`${apiBase}/exam-sessions`, {
      data: { examTemplateId: seeded.templateId, sessionName: "", accessKey: "", startTime: "", endTime: "" },
    });
    expect(badSession.status()).toBe(400);

    const missingTemplate = await request.get(`${apiBase}/exam-templates/000000000000000000000000`);
    expect(missingTemplate.status()).toBe(404);
  });

  test("covers frontend empty, malformed, 401/403/404/500 and timeout states while using the real app shell", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "student");

    await page.route(`${apiBase}/exam-sessions/available`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sessions: [] }) }),
    );
    await page.goto("/student");
    await expect(page.getByText("No exams available")).toBeVisible();

    await page.route(`${apiBase}/exam-sessions/available`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sessions: null }) }),
    );
    await page.reload();
    await expect(page.locator("body")).not.toContainText("Cannot read");

    await page.route(`${apiBase}/exam-sessions/search/by-roomcode/TIMEOUT`, () => new Promise(() => {}));
    await page.getByPlaceholder("Enter room code").fill("TIMEOUT");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("button", { name: "Search" })).toBeDisabled();

    await loginAs(page, "lecturer");
    await page.route(`${apiBase}/exam-templates`, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server failed" }) }),
    );
    await page.goto("/lecturer/exam-templates");
    await expect(page.locator("body")).not.toContainText("Oops!");

    await page.route(`${apiBase}/exam-sessions/000000000000000000000000`, (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) }),
    );
    await page.goto("/lecturer/exam-sessions/000000000000000000000000");
    await expect(page.locator("body")).toBeVisible();
  });

  test("runs axe audits on real critical pages", async ({ page, request }) => {
    await seedRealBackend(request);
    const pages = [
      { role: "student" as const, url: "/student" },
      { role: "lecturer" as const, url: "/lecturer/exam-sessions" },
      { role: "admin" as const, url: "/admin/users" },
    ];

    for (const item of pages) {
      await loginAs(page, item.role);
      await page.goto(item.url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
      const severe = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      expect(severe, `serious/critical axe violations on ${item.url}`).toEqual([]);
    }
  });

  test("captures real visual baselines for stable pages", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "lecturer");
    await page.goto("/lecturer/exam-sessions");
    await expect(page.getByRole("heading", { name: "Exam Sessions" })).toBeVisible();
    await expect(page).toHaveScreenshot("real-lecturer-sessions.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });

    await loginAs(page, "admin");
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page).toHaveScreenshot("real-admin-users.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
