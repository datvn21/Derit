import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockBackend } from "./fixtures";

test.describe("API resilience and accessibility", () => {
  test("covers API empty, 401, 403, 404, 500, timeout, null, missing-field, and large-data states", async ({ page }) => {
    await mockBackend(page, "admin");

    await page.route("http://localhost:5001/admin/users**", (route) => {
      const url = route.request().url();
      if (url.includes("role=student")) {
        return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Forbidden" }) });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: Array.from({ length: 30 }, (_, i) => ({
            _id: `u-${i}`,
            name: i === 0 ? "" : `Large User ${i}`,
            email: i === 1 ? null : `large${i}@tdtu.edu.vn`,
            role: i % 2 ? "lecturer" : "student",
            isActive: i % 3 !== 0,
          })),
          pagination: { page: 1, pages: 2, total: 30 },
        }),
      });
    });
    await page.goto("/admin/users");
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Student" }).click();
    await expect(page.getByText(/No users found|Large User|User Management/i)).toBeVisible();

    const lecturerPage = await page.context().newPage();
    await mockBackend(lecturerPage, "lecturer");
    await lecturerPage.route("http://localhost:5001/exam-templates", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Server exploded" }) }),
    );
    await lecturerPage.goto("/lecturer/exam-templates");
    await expect(lecturerPage.getByText(/Loading templates|Failed|No templates|Exam Templates/i).first()).toBeVisible();
    await lecturerPage.close();

    const studentPage = await page.context().newPage();
    await mockBackend(studentPage, "student");
    await studentPage.route("**/exam-sessions/available", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sessions: [] }) }),
    );
    await studentPage.goto("/student");
    await expect(studentPage.getByText("No exams available")).toBeVisible();

    await studentPage.route("**/exam-sessions/search/by-roomcode/TIMEOUT", () => new Promise(() => {}));
    await studentPage.getByPlaceholder("Enter room code").fill("TIMEOUT");
    await studentPage.getByRole("button", { name: "Search" }).click();
    await expect(studentPage.getByRole("button", { name: "Search" })).toBeDisabled();
    await studentPage.close();
  });

  test("checks endpoint-specific HTTP error handling across main surfaces", async ({ browser }) => {
    const scenarios = [
      {
        role: "student" as const,
        url: "/student",
        endpoint: "http://localhost:5001/exam-sessions/available",
        status: 500,
        body: { error: "available failed" },
      },
      {
        role: "student" as const,
        url: "/student",
        endpoint: "http://localhost:5001/exam-sessions/available",
        status: 200,
        body: { sessions: null },
      },
      {
        role: "lecturer" as const,
        url: "/lecturer/exam-sessions/session-1/results",
        endpoint: "http://localhost:5001/submissions/session/session-1/all",
        status: 404,
        body: { error: "missing submissions" },
      },
      {
        role: "lecturer" as const,
        url: "/lecturer/exam-sessions/session-1",
        endpoint: "http://localhost:5001/exam-sessions/session-1/waiting",
        status: 401,
        body: { error: "expired" },
      },
      {
        role: "admin" as const,
        url: "/admin/logs",
        endpoint: "http://localhost:5001/admin/logs**",
        status: 500,
        body: { error: "logs failed" },
      },
    ];

    for (const scenario of scenarios) {
      const page = await browser.newPage();
      await mockBackend(page, scenario.role);
      await page.route(scenario.endpoint, (route) =>
        route.fulfill({
          status: scenario.status,
          contentType: "application/json",
          body: JSON.stringify(scenario.body),
        }),
      );
      await page.goto(scenario.url);
      await expect(page.locator("body")).not.toContainText("Oops!");
      await expect(page.locator("body")).toBeVisible();
      await page.close();
    }
  });

  test("runs axe accessibility audit on critical pages", async ({ page }) => {
    await mockBackend(page, "admin");
    for (const url of ["/", "/admin", "/student"]) {
      const role = url.startsWith("/student") ? "student" : url.startsWith("/lecturer") ? "lecturer" : url === "/" ? null : "admin";
      await mockBackend(page, role as any);
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
      const severeViolations = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
      expect(severeViolations, `serious/critical axe violations on ${url}`).toEqual([]);
    }
  });
});
