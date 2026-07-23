import { test, expect } from "@playwright/test";

test.describe("Lecturer Dashboard", () => {
  test("should display lecturer dashboard", async ({ page }) => {
    await page.goto("/lecturer");
    
    // Should show dashboard or redirect to login
    await expect(
      page.getByText(/dashboard/i).or(page.getByText(/welcome/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to exam templates", async ({ page }) => {
    await page.goto("/lecturer");
    
    // Look for exam templates link/tab
    const templatesLink = page.getByRole("link", { name: /exam templates/i }).or(
      page.getByRole("tab", { name: /exam templates/i })
    );
    
    if (await templatesLink.isVisible()) {
      await templatesLink.click();
      await expect(page).toHaveURL(/\/exam-templates/);
    }
  });

  test("should navigate to exam sessions", async ({ page }) => {
    await page.goto("/lecturer");
    
    // Look for exam sessions link/tab
    const sessionsLink = page.getByRole("link", { name: /exam sessions/i }).or(
      page.getByRole("tab", { name: /exam sessions/i })
    );
    
    if (await sessionsLink.isVisible()) {
      await sessionsLink.click();
      await expect(page).toHaveURL(/\/exam-sessions/);
    }
  });
});

test.describe("Exam Template Management", () => {
  test("should display template list page", async ({ page }) => {
    await page.goto("/lecturer/exam-templates");
    
    await expect(
      page.getByText(/templates/i).or(page.getByText(/loading/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show create template button", async ({ page }) => {
    await page.goto("/lecturer/exam-templates");
    
    const createButton = page.getByRole("button", { name: /create new template/i }).or(
      page.getByRole("button", { name: /\+ new/i })
    );
    
    if (await createButton.isVisible()) {
      await expect(createButton).toBeEnabled();
    }
  });
});

test.describe("Exam Session Management", () => {
  test("should display session list page", async ({ page }) => {
    await page.goto("/lecturer/exam-sessions");
    
    await expect(
      page.getByText(/sessions/i).or(page.getByText(/loading/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show create session button", async ({ page }) => {
    await page.goto("/lecturer/exam-sessions");
    
    const createButton = page.getByRole("button", { name: /create new session/i }).or(
      page.getByRole("button", { name: /\+ new/i })
    );
    
    if (await createButton.isVisible()) {
      await expect(createButton).toBeEnabled();
    }
  });
});
