import { Metadata } from "next"

import { sdk } from "@lib/config"
import { getStoreName } from "@lib/util/env"

/**
 * PR-02/PR-06 — One-click unsubscribe landing page.
 *
 * Marketing emails link with `?email=&token=` (HMAC-signed by the backend);
 * stock alerts link with `?scope=stock&id=&token=` (random token). This server
 * component calls the matching backend route and renders the result — no
 * client JS needed. Invalid links show a failure message and write nothing.
 */
export const metadata: Metadata = {
  title: `Unsubscribe | ${getStoreName()}`,
  description: "Unsubscribe from marketing emails.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

type Props = {
  searchParams: Promise<{ email?: string; token?: string; scope?: string; id?: string }>
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { email, token, scope, id } = await searchParams
  let ok = false
  const isStock = scope === "stock"

  if (isStock && id && token) {
    try {
      const res = await sdk.client.fetch<{ unsubscribed?: boolean }>(
        `/store/availability/unsubscribe`,
        { method: "POST", body: { id, token } }
      )
      ok = res.unsubscribed === true
    } catch {
      ok = false
    }
  } else if (email && token) {
    try {
      const res = await sdk.client.fetch<{ unsubscribed?: boolean }>(
        `/store/marketing/unsubscribe`,
        { method: "POST", body: { email, token } }
      )
      ok = res.unsubscribed === true
    } catch {
      ok = false
    }
  }

  return (
    <div className="content-container py-12 text-center">
      <h1 className="text-2xl mb-4">
        {ok ? "You've been unsubscribed" : "That link didn't work"}
      </h1>
      <p className="text-ui-fg-subtle">
        {ok
          ? isStock
            ? "You won't receive stock alerts for that product anymore."
            : "You won't receive marketing emails from us anymore. Order confirmations and account emails are unaffected."
          : "The unsubscribe link is invalid or expired. Please contact us if this keeps happening."}
      </p>
    </div>
  )
}
