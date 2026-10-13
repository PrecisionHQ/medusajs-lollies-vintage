/**
 * Pure validation for product Q&A (#11). Kept free of Medusa imports so it
 * is unit-testable in milliseconds; the store route is a thin wrapper.
 */
export const QUESTION_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Max open questions per email per product per rolling day. */
export const QUESTION_DAILY_CAP = 3;

/** Returns the rejection message, or null when the input is acceptable. */
export function validateQuestionInput(input: {
  name?: unknown;
  email?: unknown;
  question?: unknown;
}): string | null {
  const { name, email, question } = input;
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 60
  ) {
    return "name must be 2-60 characters.";
  }
  if (typeof email !== "string" || !QUESTION_EMAIL_RE.test(email.trim())) {
    return "a valid email is required.";
  }
  if (
    typeof question !== "string" ||
    question.trim().length < 10 ||
    question.trim().length > 2000
  ) {
    return "question must be 10-2000 characters.";
  }
  return null;
}

export function overDailyCap(recentCount: number): boolean {
  return recentCount >= QUESTION_DAILY_CAP;
}
