"use client"

import { getConsent } from "./posthog"
import { mapToPixelEvents } from "./pixel-events"

/**
 * P6 — Ad pixels (Meta + TikTok), consent-gated like PostHog.
 *
 * Nothing loads or fires until the shopper accepts the consent banner,
 * and nothing is configured until real pixel IDs are set: missing or
 * placeholder IDs keep everything inert (fail closed). Autocapture stays
 * off everywhere — every call below comes from an explicit funnel event
 * via trackPixel(), wired next to track() in TrackView.
 *
 * Ad-blockers remove fbq/ttq at the network level; every access is
 * guarded so a blocked pixel can never break shopping.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: { track: (...args: any[]) => void; page: (...args: any[]) => void; load: (...args: any[]) => void };
  }
}

const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ""
const TIKTOK_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? ""

function idIsReal(id: string): boolean {
  const v = (id || "").trim()
  if (v.length < 5) return false
  return !/STUB|PLACEHOLDER|EXAMPLE|XXX|YOUR_|TEST/i.test(v)
}

const loaded: Record<string, boolean> = {}

function injectScript(src: string, id: string, onload?: () => void) {
  if (typeof document === "undefined") return
  if (document.querySelector(`script[data-pixel="${id}"]`)) return
  const el = document.createElement("script")
  el.async = true
  el.src = src
  el.dataset.pixel = id
  if (onload) {
    el.onload = onload
  }
  document.head.appendChild(el)
}

function loadMeta() {
  if (loaded.meta || typeof window === "undefined") return
  loaded.meta = true
  const w = window as any
  if (typeof w.fbq !== "function") {
    let n: any
    // Standard Meta stub: queues calls made before the library arrives.
    n = w.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args)
    }
    n.push = n
    n.loaded = true
    n.version = "2.0"
    n.queue = []
  }
  window.fbq?.("init", META_ID)
  injectScript("https://connect.facebook.net/en_US/fbevents.js", `meta-${META_ID}`)
}

function loadTiktok() {
  if (loaded.tiktok || typeof window === "undefined") return
  loaded.tiktok = true
  const w = window as any
  // Queue pre-load calls locally; unlike the Meta stub (whose shape the
  // real library replays itself), a custom queue needs an explicit flush.
  let queue: any[] | null = null
  if (!w.ttq || typeof w.ttq.track !== "function") {
    queue = []
    const q: any[] = queue
    w.ttq = {
      track: (...args: any[]) => {
        if (q.length < 50) q.push(["track", ...args])
      },
      page: (...args: any[]) => {
        if (q.length < 50) q.push(["page", ...args])
      },
      load: () => {},
    }
  }
  try {
    window.ttq?.load(TIKTOK_ID)
  } catch {
    // Older stub shape; direct method calls below still work post-load.
  }
  injectScript(
    `https://analytics.tiktok.com/i18n/pixel/sdk.js?sdkid=${encodeURIComponent(TIKTOK_ID)}`,
    `tiktok-${TIKTOK_ID}`,
    () => {
      try {
        const t = (window as any).ttq
        if (queue && t && typeof t.track === "function") {
          for (const [method, ...args] of queue.splice(0)) {
            if (method === "page") t.page?.(...args)
            else t.track(...args)
          }
        }
      } catch {
        // Drop queued calls rather than risk duplicates.
      }
    }
  )
}

/** Fire the pixel-mapped calls for one funnel event. Silent no-op unless consented + configured. */
export function trackPixel(event: string, properties?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined") return
    if (getConsent() !== "accepted") return
    const metaOn = idIsReal(META_ID)
    const tiktokOn = idIsReal(TIKTOK_ID)
    if (!metaOn && !tiktokOn) return
    if (metaOn) loadMeta()
    if (tiktokOn) loadTiktok()

    for (const call of mapToPixelEvents(event, properties ?? {})) {
      if (call.network === "meta") {
        if (!metaOn || typeof window.fbq !== "function") continue
        if (call.method === "page") {
          window.fbq("track", "PageView")
        } else {
          window.fbq("track", call.name, call.params ?? {}, call.options ?? {})
        }
      } else {
        if (!tiktokOn || !window.ttq) continue
        if (call.method === "page") {
          window.ttq.page?.()
        } else if (typeof window.ttq.track === "function") {
          window.ttq.track(call.name, call.params ?? {}, call.options ?? {})
        }
      }
    }
  } catch {
    // Pixels must never break shopping (including under ad-blockers).
  }
}
