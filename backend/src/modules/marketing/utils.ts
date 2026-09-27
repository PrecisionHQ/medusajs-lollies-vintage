import { createHmac, timingSafeEqual } from "crypto";
import { COOKIE_SECRET, STOREFRONT_URL } from "../../lib/constants";

/**
 * Signed one-click unsubscribe tokens.
 *
 * The emailed link is the only proof of ownership (the route is unauthenticated),
 * so the token must not be guessable: HMAC-SHA256 over the lowercase email with
 * COOKIE_SECRET. Verification is timing-safe and rejects malformed tokens.
 */
export function signUnsubscribeToken(email: string): string {
  return createHmac("sha256", COOKIE_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token || token.length !== 64) {
    return false;
  }
  const expected = Buffer.from(signUnsubscribeToken(email));
  const actual = Buffer.from(token);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

export function buildUnsubscribeLink(email: string): string {
  // No region prefix: storefront middleware.ts adds the visitor's country
  // and preserves the query string (same pattern as password-reset links).
  const base = STOREFRONT_URL.replace(/\/$/, "");
  const params = new URLSearchParams({
    email,
    token: signUnsubscribeToken(email),
  });
  return `${base}/unsubscribe?${params.toString()}`;
}

export function buildRecoveryLink(cartId: string): string {
  const base = STOREFRONT_URL.replace(/\/$/, "");
  return `${base}/cart/recover/${cartId}`;
}
