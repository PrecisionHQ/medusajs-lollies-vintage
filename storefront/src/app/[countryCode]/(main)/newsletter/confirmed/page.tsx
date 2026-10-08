import { Metadata } from "next"

import { sdk } from "@lib/config"
import { getStoreName } from "@lib/util/env"

/**
 * Double opt-in landing page for the owned newsletter list.
 *
 * The confirm email links here with `?token=` (random, single-purpose — the
 * subscription row is still pending until clicked). This server component
 * calls the backend confirm route and renders the result — no client JS
 * needed. Unknown tokens show a failure message and write nothing.
 */
export const metadata: Metadata = {
  title: `Subscription confirmed | ${getStoreName()}`,
  description: "Confirm your newsletter subscription.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function NewsletterConfirmedPage({
  searchParams,
}: Props) {
  const { token } = await searchParams
  let ok = false

  if (token) {
    try {
      const res = await sdk.client.fetch<{ confirmed?: boolean }>(
        `/store/newsletter/confirm`,
        { method: "POST", body: { token } }
      )
      ok = res.confirmed === true
    } catch {
      ok = false
    }
  }

  return (
    <div className="content-container py-12 text-center">
      <h1 className="text-2xl mb-4">
        {ok ? "You're on the list" : "That link didn't work"}
      </h1>
      <p className="text-ui-fg-subtle">
        {ok
          ? "Your subscription is confirmed — drops, restocks and subscriber-only offers, never spam. Unsubscribe anytime from any email."
          : "The confirmation link is invalid. Please subscribe again and click the newest email."}
      </p>
    </div>
  )
}
