"use client"

import { useEffect } from "react"

import { track } from "@lib/analytics/posthog"

/**
 * PR-05 — Fire one analytics event on mount (client-side only, after the
 * consent gate inside track()). Mount on page templates, e.g.
 * <TrackView event="product_viewed" properties={{ product_id, handle }} />.
 */
export default function TrackView({
  event,
  properties,
}: {
  event: string
  properties?: Record<string, unknown>
}) {
  useEffect(() => {
    track(event, properties)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])
  return null
}
