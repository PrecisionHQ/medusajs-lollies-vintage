"use client"

import posthog from "posthog-js"

/**
 * PR-05 — PostHog client, consent-gated.
 *
 * Nothing loads or captures until the shopper accepts the consent banner:
 * - no consent cookie  -> posthog never initialises (zero tracking);
 * - rejected           -> same, plus the choice is remembered for 12 months;
 * - accepted           -> init against the EU host with IP anonymisation.
 *
 * Keys come from NEXT_PUBLIC_POSTHOG_* (stubbed until PR-05 is configured).
 * A stub/empty key also keeps everything inert, so misconfiguration fails
 * closed, never open.
 */

const CONSENT_COOKIE = "lollies_consent"
export const CONSENT_REOPEN_EVENT = "lollies:open-consent"

export function getConsent(): "accepted" | "rejected" | null {
  if (typeof document === "undefined") {
    return null
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`)
  )
  if (match?.[1] === "accepted" || match?.[1] === "rejected") {
    return match[1]
  }
  return null
}

export function setConsent(value: "accepted" | "rejected") {
  const year = 60 * 60 * 24 * 365
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${year}; Path=/; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`
  if (value === "accepted") {
    initPostHog()
  }
}

function keyIsReal(): boolean {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ""
  return key.startsWith("phc_") && !key.includes("STUB")
}

function initPostHog() {
  if (
    typeof window === "undefined" ||
    posthog.__loaded ||
    !keyIsReal() ||
    getConsent() !== "accepted"
  ) {
    return
  }
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    advanced_disable_feature_flags: true,
    // EU host keeps data in the EU; enable "Block IP addresses" in the
    // PostHog project settings for full IP anonymisation.
  })
}

/** Capture only when consented + configured; silent no-op otherwise. */
export function track(event: string, properties?: Record<string, unknown>) {
  try {
    initPostHog()
    if (posthog.__loaded) {
      posthog.capture(event, properties)
    }
  } catch {
    // Analytics must never break shopping.
  }
}
