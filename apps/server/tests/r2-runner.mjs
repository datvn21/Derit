import assert from "assert";
import {
  isR2Configured,
  getR2PublicUrl,
  resolveLocalPdfPath,
  uploadSessionPdfs,
  deleteSessionPdfs,
} from "../src/services/r2Service.js";

console.log("▶ Running R2 Service Unit Tests...");

// Test 1: isR2Configured
const originalEnv = { ...process.env };
delete process.env.R2_ACCOUNT_ID;
assert.strictEqual(isR2Configured(), false, "Should return false when R2 env is missing");

process.env.R2_ACCOUNT_ID = "acc-123";
process.env.R2_ACCESS_KEY_ID = "key-123";
process.env.R2_SECRET_ACCESS_KEY = "sec-123";
process.env.R2_BUCKET_NAME = "bucket-test";
assert.strictEqual(isR2Configured(), true, "Should return true when all R2 envs are present");

// Test 2: getR2PublicUrl with custom public domain
process.env.R2_PUBLIC_URL = "https://pub-abc.r2.dev/";
const url1 = getR2PublicUrl("sessions/123/code_1_de1.pdf");
assert.strictEqual(
  url1,
  "https://pub-abc.r2.dev/sessions/123/code_1_de1.pdf",
  "Should format public URL correctly without double slashes",
);

// Test 3: getR2PublicUrl fallback when R2_PUBLIC_URL is empty
delete process.env.R2_PUBLIC_URL;
const url2 = getR2PublicUrl("sessions/123/code_1_de1.pdf");
assert.strictEqual(
  url2,
  "https://acc-123.r2.cloudflarestorage.com/bucket-test/sessions/123/code_1_de1.pdf",
  "Should construct default endpoint URL when public URL is not set",
);

// Test 4: resolveLocalPdfPath
const resolved = resolveLocalPdfPath("/uploads/pdfs/sample-test.pdf");
assert.strictEqual(resolved.filename, "sample-test.pdf");
assert(resolved.candidatePdfsPath.includes("sample-test.pdf"));

// Test 5: Graceful fallback when R2 is not configured
delete process.env.R2_ACCOUNT_ID;
const unconfiguredUpload = await uploadSessionPdfs(
  { _id: "dummy-id" },
  { examCodes: [{ codeNumber: "101", pdfUrl: "/uploads/pdfs/dummy.pdf" }] },
);
assert.deepStrictEqual(unconfiguredUpload, [], "Should gracefully return empty array when not configured");

await deleteSessionPdfs("dummy-id"); // should not throw

// Restore env
process.env = originalEnv;

console.log("✔ All R2 unit tests passed successfully!");
