/**
 * Phase 4 (F1) — creator input validation. Pure (no container), so it is
 * unit-testable. Handles are URL-safe slugs: lowercase alphanumerics,
 * dashes and underscores, 2–40 chars.
 */

export function validateHandle(handle: unknown): string | null {
  if (typeof handle !== "string") {
    return "handle is required.";
  }
  const clean = handle.trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(clean)) {
    return "handle must be 2-40 lowercase letters, numbers, dashes or underscores.";
  }
  return null;
}

export function cleanHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function validateCommission(pct: unknown): string | null {
  if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    return "commission_pct must be 0-100.";
  }
  return null;
}
