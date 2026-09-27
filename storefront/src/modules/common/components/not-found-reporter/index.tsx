"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { sdk } from "@lib/config"

/**
 * PR-15 — Reports 404s to the backend log (path-only, hit-counted) so the
 * Redirects admin page can prioritize by pain. Fire-and-forget: failures
 * are swallowed, and it never renders anything.
 */
export default function NotFoundReporter() {
  const pathname = usePathname()

  useEffect(() => {
    sdk.client
      .fetch(`/store/redirects/404-log`, {
        method: "POST",
        body: { path: pathname },
      })
      .catch(() => {})
  }, [pathname])

  return null
}
