import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, "../../../..");
export const apiBase = "http://localhost:5001";

export function readEnvFile(filePath: string) {
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

export function loadServerEnv() {
  const serverEnv = readEnvFile(path.join(repoRoot, "apps/server/.env"));
  for (const [key, value] of Object.entries(serverEnv)) {
    process.env[key] = value;
  }
  return serverEnv;
}

export async function seedRealBackend(request: APIRequestContext) {
  test.skip(
    process.env.E2E_ALLOW_DB_MUTATION !== "true",
    "Set E2E_ALLOW_DB_MUTATION=true in apps/server/.env and use an isolated E2E database to run real E2E flows.",
  );
  const response = await request.post(`${apiBase}/__e2e/seed`);
  await expect(response).toBeOK();
  return response.json();
}

export async function loginAs(
  target: Page | APIRequestContext,
  role: "student" | "lecturer" | "admin",
) {
  const request = "request" in target ? target.request : target;
  const response = await request.get(`${apiBase}/__e2e/login/${role}`);
  await expect(response).toBeOK();
}

