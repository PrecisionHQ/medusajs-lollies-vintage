"use client"

import { CONSENT_REOPEN_EVENT } from "@lib/analytics/posthog"

/**
 * PR-05 — Footer button that re-opens the consent banner so shoppers can
 * change their analytics choice at any time (GDPR: consent must be as easy
 * to withdraw as to give).
 */
export default function CookieSettings() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT))}
      className="hover:text-ui-fg-base"
    >
      Cookie settings
    </button>
  )
}
