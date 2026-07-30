import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TestCases from "../../../app/components/Exam/TestCases";
import type { TestCase } from "../../../app/components/Exam/TestCases";

const createTestCase = (overrides: Partial<TestCase> = {}): TestCase => ({
  id: 1,
  input: "test input",
  expectedOutput: "expected output",
  ...overrides,
});

describe("TestCases Component", () => {
  it("renders empty state when no test cases", () => {
    render(<TestCases testCases={[]} />);
    expect(screen.getByText(/no test case/i)).toBeInTheDocument();
  });

  it("renders row index for each visible test case", () => {
    const testCases = [
      createTestCase({ id: 1, input: "input1", expectedOutput: "output1" }),
      createTestCase({ id: 2, input: "input2", expectedOutput: "output2" }),
    ];

    render(<TestCases testCases={testCases} />);

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("displays passed status pill on the row", () => {
    const testCases = [
      createTestCase({
        id: 1,
        status: "passed",
        actualOutput: "expected output",
      }),
    ];

    render(<TestCases testCases={testCases} />);

    // Scope to <ul role="list"> to skip the summary stat label that also says "Passed".
    const list = screen.getByRole("list");
    expect(within(list).getByText(/^passed$/i)).toBeInTheDocument();
  });

  it("displays failed status pill on the row", () => {
    const testCases = [
      createTestCase({
        id: 1,
        status: "failed",
        actualOutput: "wrong output",
      }),
    ];

    render(<TestCases testCases={testCases} />);

    const list = screen.getByRole("list");
    expect(within(list).getByText(/^failed$/i)).toBeInTheDocument();
  });

  it("shows question label when provided", () => {
    const testCases = [createTestCase({ id: 1 })];

    render(<TestCases testCases={testCases} questionNumber={1} />);

    expect(screen.getByText(/question 1/i)).toBeInTheDocument();
  });

  it("shows loading state when isRunning is true and no per-row runner active", () => {
    const testCases = [createTestCase({ id: 1 })];

    render(<TestCases testCases={testCases} isRunning={true} />);

    expect(screen.getByText(/running tests/i)).toBeInTheDocument();
  });

  it("displays passed/failed/pending counts in the header summary", () => {
    const testCases = [
      createTestCase({ id: 1, status: "passed", actualOutput: "output" }),
      createTestCase({ id: 2, status: "passed", actualOutput: "output" }),
      createTestCase({ id: 3, status: "failed", actualOutput: "wrong" }),
    ];

    render(<TestCases testCases={testCases} />);

    const summary = screen.getByLabelText(/test result summary/i);
    // 3 numeric values: 2 passed, 1 failed, 0 pending
    expect(within(summary).getByText("2")).toBeInTheDocument();
    expect(within(summary).getByText("1")).toBeInTheDocument();
    expect(within(summary).getByText("0")).toBeInTheDocument();
  });

  it("renders summary mini-stats with passed/failed/pending counts", () => {
    const testCases = [
      createTestCase({ id: 1, status: "passed", actualOutput: "o" }),
      createTestCase({ id: 2, status: "failed", actualOutput: "x" }),
      createTestCase({ id: 3, status: "pending" }),
    ];

    render(<TestCases testCases={testCases} />);

    const summary = screen.getByLabelText(/test result summary/i);
    expect(within(summary).getByText("Passed")).toBeInTheDocument();
    expect(within(summary).getByText("Failed")).toBeInTheDocument();
    expect(within(summary).getByText("Pending")).toBeInTheDocument();

    const passedStat = within(summary)
      .getByText("Passed")
      .closest("div")!;
    expect(passedStat.querySelector(".tabular-nums")?.textContent).toBe("1");
  });

  it("hides hidden test cases from display", () => {
    const testCases = [
      createTestCase({ id: 1, input: "in1" }),
      createTestCase({ id: 2, input: "in2", isHidden: true }),
    ];

    render(<TestCases testCases={testCases} />);

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText(/1 hidden test case/i)).toBeInTheDocument();
    expect(screen.queryByText("#2")).not.toBeInTheDocument();
  });

  it("formats execution time in the row header when available", () => {
    const testCases = [
      createTestCase({
        id: 1,
        status: "passed",
        actualOutput: "output",
        executionTime: 150,
      }),
    ];

    render(<TestCases testCases={testCases} />);

    expect(screen.getByText("150 ms")).toBeInTheDocument();
  });

  it("shows error status pill on the row", () => {
    const testCases = [
      createTestCase({
        id: 1,
        status: "error",
        errorMessage: "Compilation error",
      }),
    ];

    render(<TestCases testCases={testCases} />);

    const list = screen.getByRole("list");
    expect(within(list).getByText(/^error$/i)).toBeInTheDocument();
  });

  it("renders run-this-test button when hasTestFile is true", () => {
    const tcs = [createTestCase({ id: 1, hasTestFile: true })];
    const onRun = vi.fn();
    render(<TestCases testCases={tcs} onRunTestCase={onRun} />);
    expect(
      screen.getByRole("button", { name: /run test case 1/i }),
    ).toBeInTheDocument();
  });

  it("renders Run-all button next to the header when onRunAll is provided", () => {
    const tcs = [createTestCase({ id: 1 })];
    const onRunAll = vi.fn();
    render(<TestCases testCases={tcs} onRunAll={onRunAll} />);

    const btn = screen.getByRole("button", { name: /run all test cases/i });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onRunAll).toHaveBeenCalledTimes(1);
  });

  it("does not render Run-all button when onRunAll is omitted", () => {
    render(<TestCases testCases={[createTestCase({ id: 1 })]} />);
    expect(
      screen.queryByRole("button", { name: /run all test cases/i }),
    ).not.toBeInTheDocument();
  });

  it("disables Run-all button while running or when explicitly disabled", () => {
    const tcs = [createTestCase({ id: 1 })];
    const onRunAll = vi.fn();
    const { rerender } = render(
      <TestCases testCases={tcs} onRunAll={onRunAll} isRunning />,
    );
    let btn = screen.getByRole("button", { name: /run all test cases/i });
    expect(btn).toBeDisabled();

    rerender(
      <TestCases
        testCases={tcs}
        onRunAll={onRunAll}
        isRunAllDisabled
      />,
    );
    btn = screen.getByRole("button", { name: /run all test cases/i });
    expect(btn).toBeDisabled();
  });
});
