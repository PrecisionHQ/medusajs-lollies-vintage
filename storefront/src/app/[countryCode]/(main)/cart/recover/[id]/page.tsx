import { Metadata } from "next"
import { redirect } from "next/navigation"

import { sdk } from "@lib/config"
import { setCartId } from "@lib/data/cookies"
import { getStoreName } from "@lib/util/env"

/**
 * PR-02 — Abandoned-cart recovery landing page.
 *
 * The emailed link is region-free (`/cart/recover/:id`); middleware adds the
 * visitor's country prefix. If the cart still exists and isn't completed, its
 * id becomes the visitor's cart cookie and they land on /cart with everything
 * intact. Otherwise an explanatory message (already ordered, expired, unknown).
 */
export const metadata: Metadata = {
  title: `Your cart | ${getStoreName()}`,
  description: "Return to your cart.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

type Props = {
  params: Promise<{ countryCode: string; id: string }>
}

export default async function RecoverCartPage({ params }: Props) {
  const { countryCode, id } = await params
  let problem: string | null = null

  try {
    const { cart } = await sdk.client.fetch<{ cart?: { id: string; completed_at?: string | null } }>(
      `/store/carts/${id}`
    )
    if (!cart) {
      problem = "We couldn't find that cart — it may have expired."
    } else if (cart.completed_at) {
      problem = "This cart was already ordered. Thank you!"
    } else {
      await setCartId(cart.id)
    }
  } catch {
    problem = "We couldn't find that cart — it may have expired."
  }

  if (!problem) {
    redirect(`/${countryCode}/cart`)
  }

  return (
    <div className="content-container py-12 text-center">
      <h1 className="text-2xl mb-4">Your cart</h1>
      <p className="text-ui-fg-subtle">{problem}</p>
    </div>
  )
}
