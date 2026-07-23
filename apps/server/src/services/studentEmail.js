/**
 * Email normalisation helpers — shared across session and submission code.
 *
 * The student-id convention in this codebase is "username" (which is
 * expanded to `${id}@student.tdtu.edu.vn`). Pure functions live here so
 * they're easy to unit-test.
 */

const STUDENT_EMAIL_DOMAIN = "student.tdtu.edu.vn";

/**
 * Convert a list of student identifiers into full emails.
 *  - if the entry contains "@" it's treated as an email
 *  - everything else is appended with the default student domain
 *  - blank entries are dropped
 */
export function normalizeEmails(emails, domain = STUDENT_EMAIL_DOMAIN) {
  if (!Array.isArray(emails)) return [];
  const out = [];
  for (const raw of emails) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out.push(trimmed.includes("@") ? trimmed : `${trimmed}@${domain}`);
  }
  // Deduplicate while preserving order.
  return Array.from(new Set(out));
}
