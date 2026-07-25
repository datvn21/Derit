import { test, expect } from "@playwright/test";
import { installPageGuards, mockBackend } from "./fixtures";

test.describe("Admin journeys", () => {
  test("covers dashboard cards, user filters/modals/pagination, logs, settings, logout, and refresh", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "admin");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    await page.getByRole("link", { name: /Manage Users/i }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByPlaceholder(/Search by name/i).fill("unicode tiếng việt");
    await page.keyboard.press("Enter");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Student" }).click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Inactive" }).click();

    await page.getByRole("button", { name: /Create User/i }).click();
    await expect(page.getByRole("dialog")).toContainText("Create New User");
    await page.getByLabel("Email").fill("bad-email");
    await page.getByLabel("Name").fill("   ");
    await page.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Admin" }).click();
    await page.getByRole("button", { name: /^Create User$/ }).click();
    await expect(page.getByText("User created successfully")).toBeVisible();

    await page.getByRole("row", { name: /Super Admin/ }).locator("button").first().click();
    await expect(page.getByRole("dialog")).toContainText("Edit User");
    await page.getByLabel("Name").fill("Admin Updated ' OR 1=1 --");
    await page.getByLabel("Active").uncheck();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("User updated successfully")).toBeVisible();

    await page.getByRole("row", { name: /Super Admin/ }).locator("button").last().click();
    await expect(page.getByRole("dialog")).toContainText("Delete User");
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button").filter({ has: page.locator("svg") }).last().click();
    await expect(page.getByText(/Page 2 of 2|Page 1 of 2/)).toBeVisible();

    await page.getByRole("link", { name: /Activity Logs/i }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Activity Logs" })).toBeVisible();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "User Created" }).click();
    await expect(page.getByRole("table")).toContainText("login");

    await page.getByRole("link", { name: /Settings/i }).click();
    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();
    await page.getByLabel("System Name").fill("DERIT QA");
    await page.getByLabel("Allow Student Registration").uncheck();
    await expect(page.getByLabel("Allowed Student Email Domains")).toBeHidden();
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    await page.getByRole("button", { name: /Super Admin/i }).click();
    await page.getByRole("menuitem", { name: /Logout/i }).click();
    await expect(page).toHaveURL(/\/$/);

    await guards.assertClean();
  });
});
