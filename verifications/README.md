# Verification & Rollout

This directory describes how the Derit monorepo validates behaviour before
shipping any of the refactor phases described in the plan at
`/home/whojsdat/.cursor/plans/refactor_quality_security_91c51421.plan.md`.

## Running the suites

### Server
```bash
cd apps/server
npm run test:unit           # Node-only unit tests (no MongoDB required)
npm run test:integration    # Jest + Supertest against the test DB
```

### Web
```bash
cd apps/web
npm run dev
# In another shell:
npx playwright test
```

### End-to-end (HTTP API)
```bash
cd apps/web
E2E_BASE_URL=http://localhost:3000 npx playwright test
```

## Characterization tests

Characterization tests lock the *current* behaviour of high-risk
components/route before they get decomposed. The goal is to:

  - Defend the grading pipeline (per-testcase status, score aggregation,
    autosave beacon shape) while we restructure `submission.js`.
  - Capture the SSE event ordering so re-implementing the rate-limited
    BoundedCache doesn't break the EventSource reconnect story.
  - Pin the OAuth callback redirects so role assignment isn't accidentally
    changed during the auth-policy refactor.

Spec files live in `tests/characterization/`.

## CI gates

The pipeline should run, in order:

  1. **Lint + typecheck** — fast fail.
  2. **Server unit tests** (the `node tests/*.mjs` runners).
  3. **Server integration tests** (Jest + Supertest) against a Mongo test
     container.
  4. **Sandbox integration** — `nsjail-java`/`nsjail-python` smoke tests
     guarded behind `RUN_SANDBOX_TESTS=1`.
  5. **Web unit tests** (Vitest/Testing Library).
  6. **Playwright E2E** on a real browser against the dev server.

Coverage thresholds are intentionally not pinned yet — the current
characterization suite is meant to defend existing flows without gating
on a number that the existing tests can't honestly meet.

## Rollout of legacy removal

Rules:

  - Anything named `legacy/` or marked `@deprecated` must remain in place
    until the new path has shipped + been observed for at least one week.
  - Deletion goes in its own commit named `chore: drop legacy <feature>`.
  - The diff for deletion must include the replacement file as a
    neighbour change so the history remains bisectable.
