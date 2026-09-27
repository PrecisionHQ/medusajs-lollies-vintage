/**
 * PR-15 — Path normalization shared by the API routes (single source so
 * middleware matching and stored rows can never disagree on form).
 */
export function normalizeRedirectPath(input: string): string {
  let p = (input ?? "").trim().toLowerCase();
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  while (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
}
