/**
 * Pure helpers for the lecturer ExamSessionDetail page.
 * Extracted so they can be unit-tested without pulling in React/Router state.
 */

/** Format a UTC date to the local datetime-local input format (YYYY-MM-DDTHH:mm). */
export function formatToLocalDateTime(utcDate: string | Date): string {
  const date = new Date(utcDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Strip the university email domain so admins can read short local-part IDs. */
export function stripUniversityDomain(emails: string[]): string[] {
  return emails.map((e) =>
    e.endsWith("@student.tdtu.edu.vn") ? e.replace("@student.tdtu.edu.vn", "") : e,
  );
}

/** Add the university email domain to short student IDs. */
export function withUniversityDomain(input: string): string {
  return input.includes("@") ? input : `${input}@student.tdtu.edu.vn`;
}

/** Map exam-session status string to the Badge variant prop. */
export type SessionStatusVariant = "default" | "success" | "warning" | "destructive" | "info";

export const STATUS_VARIANT_MAP: Record<string, SessionStatusVariant> = {
  scheduled: "info",
  ongoing: "warning",
  ended: "destructive",
  graded: "success",
};