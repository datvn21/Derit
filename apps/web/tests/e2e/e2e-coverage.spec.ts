import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { mockBackend } from "./fixtures";

test.describe("E2E JavaScript coverage metric", () => {
  test("records Chromium JS byte coverage for primary user surfaces", async ({ page }) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });

    await mockBackend(page, null);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "DERIT" })).toBeVisible();

    await mockBackend(page, "student");
    await page.goto("/student");
    await expect(page.getByRole("heading", { name: /Welcome, Nguyen Van An/i })).toBeVisible();
    await page.goto("/student/exam/session-1");
    await expect(page.getByRole("heading", { name: "Java Arrays Final" })).toBeVisible();

    await mockBackend(page, "lecturer");
    await page.goto("/lecturer/exam-templates");
    await expect(page.getByRole("heading", { name: "Exam Templates" })).toBeVisible();
    await page.goto("/lecturer/exam-sessions/session-1/results");
    await expect(page.getByRole("heading", { name: "Java Midterm Room 101" })).toBeVisible();

    await mockBackend(page, "admin");
    await page.goto("/admin/users");
    await expect(page.getByRole("table")).toBeVisible();

    const coverage = await page.coverage.stopJSCoverage();
    const appEntries = coverage.filter((entry) => entry.url.includes("localhost:5173"));
    const totals = appEntries.reduce(
      (acc, entry: any) => {
        const ranges = entry.functions.flatMap((fn: any) => fn.ranges);
        ranges.sort((a: any, b: any) => a.startOffset - b.startOffset);
        const mergedRanges = ranges.reduce<{ startOffset: number; endOffset: number }[]>((merged, range) => {
          const last = merged.at(-1);
          if (!last || range.startOffset > last.endOffset) {
            merged.push({ startOffset: range.startOffset, endOffset: range.endOffset });
          } else {
            last.endOffset = Math.max(last.endOffset, range.endOffset);
          }
          return merged;
        }, []);
        const usedBytes = mergedRanges.reduce(
          (sum, range) => sum + range.endOffset - range.startOffset,
          0,
        );
        const totalBytes = typeof entry.text === "string" ? entry.text.length : 0;
        return {
          usedBytes: acc.usedBytes + usedBytes,
          totalBytes: acc.totalBytes + totalBytes,
        };
      },
      { usedBytes: 0, totalBytes: 0 },
    );

    const report = {
      generatedAt: new Date().toISOString(),
      entryCount: appEntries.length,
      usedBytes: totals.usedBytes,
      totalBytes: totals.totalBytes || null,
      percent: totals.totalBytes === 0 ? null : Number(((totals.usedBytes / totals.totalBytes) * 100).toFixed(2)),
      note:
        totals.totalBytes === 0
          ? "This Playwright/Chromium coverage payload did not include source text, so the report records executed JS bytes instead of a percentage."
          : undefined,
    };

    fs.mkdirSync(path.join(process.cwd(), "test-results"), { recursive: true });
    fs.writeFileSync(
      path.join(process.cwd(), "test-results/e2e-js-coverage.json"),
      JSON.stringify(report, null, 2),
    );

    expect(report.entryCount).toBeGreaterThan(0);
    expect(report.usedBytes).toBeGreaterThan(0);
  });
});
