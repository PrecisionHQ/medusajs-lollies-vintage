/**
 * Newsletter popup suppression ("don't nag after signup").
 *
 * Both newsletter forms (footer + auto-popup) mark this flag on successful
 * subscribe; the popup checks it before showing. localStorage, not a cookie:
 * nothing server-side needs it, so nothing is sent on any request.
 * Same-browser only by nature — a new device legitimately sees the popup
 * again. All access is guarded: private-mode storage throws, and a throw
 * must never break a form submit or a page render.
 */
const KEY = "lollies_newsletter_subscribed"

export function hasSubscribedNewsletter(): boolean {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function markNewsletterSubscribed(): void {
  try {
    localStorage.setItem(KEY, "1")
  } catch {
    // Storage unavailable — the popup simply shows again next visit.
  }
}
