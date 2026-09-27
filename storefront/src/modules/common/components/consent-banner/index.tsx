"use client"

import { useEffect, useState } from "react"

import {
  CONSENT_REOPEN_EVENT,
  getConsent,
  setConsent,
} from "@lib/analytics/posthog"

/**
 * PR-05 — GDPR consent banner.
 *
 * Hidden until needed: renders nothing when a choice cookie already exists.
 * Accept loads PostHog (EU host, anonymised IP, no autocapture); Reject keeps
 * everything inert. The footer "Cookie settings" button re-opens it via a
 * window event. No pre-ticked boxes, reject one click from accept.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!getConsent()) {
      setVisible(true)
    }
    const reopen = () => setVisible(true)
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen)
  }, [])

  if (!visible) {
    return null
  }

  const choose = (value: "accepted" | "rejected") => {
    setConsent(value)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-50 border-t border-ui-border-base bg-ui-bg-base px-4 py-4"
    >
      <div className="content-container flex flex-col small:flex-row items-start small:items-center gap-x-6 gap-y-3">
        <p className="text-small-regular text-ui-fg-subtle flex-1">
          We use privacy-friendly analytics to understand which products people
          love. No ads, no cross-site tracking, data stays in the EU. You can
          change your mind anytime via Cookie settings in the footer.
        </p>
        <div className="flex gap-x-2 shrink-0">
          <button
            onClick={() => choose("rejected")}
            className="rounded border border-ui-border-strong px-4 py-2 text-small-regular"
          >
            Reject
          </button>
          <button
            onClick={() => choose("accepted")}
            className="rounded bg-ui-fg-base text-ui-fg-on-inverted px-4 py-2 text-small-regular"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
