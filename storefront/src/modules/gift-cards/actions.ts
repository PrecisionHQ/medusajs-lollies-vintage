"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders, getCartId, revalidateCacheTag } from "@lib/data/cookies"

/**
 * Gift card cart actions (isolated carry-over block).
 *
 * The whole gift-card shopper flow lives behind these three server actions
 * plus the <GiftCardCode> component, so a future storefront template can
 * lift this folder and the two one-line insertions in the cart/checkout
 * summaries wholesale. Talks to the official Loyalty Plugin store API
 * (POST/DELETE /store/carts/:id/gift-cards), which the js-sdk has no
 * typed methods for - hence raw client.fetch like retrieveCart uses.
 */

export type AppliedGiftCard = {
  code: string
  amount: number
}

export async function applyGiftCard(code: string) {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found")
  }
  const trimmed = code.trim()
  if (!trimmed) {
    throw new Error("Enter a gift card code.")
  }

  await sdk.client
    .fetch(`/store/carts/${cartId}/gift-cards`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { code: trimmed },
    })
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)
}

export async function removeGiftCard(code: string) {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found")
  }

  await sdk.client
    .fetch(`/store/carts/${cartId}/gift-cards`, {
      method: "DELETE",
      headers: { ...(await getAuthHeaders()) },
      body: { code },
    })
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)
}

/**
 * Credit lines carry reference_id but no code, so resolve each applied
 * gift-card credit line back to its code for display/removal.
 */
export async function listAppliedGiftCards(creditLines?: {
  reference?: string | null
  reference_id?: string | null
  amount?: number | null
}[] | null): Promise<AppliedGiftCard[]> {
  const lines = (creditLines ?? []).filter(
    (line) => line.reference === "gift-card" && line.reference_id
  )
  if (!lines.length) {
    return []
  }

  const resolved = await Promise.all(
    lines.map(async (line) => {
      try {
        const { gift_card } = await sdk.client.fetch<{
          gift_card: { code?: string | null }
        }>(`/store/gift-cards/${line.reference_id}`, {
          headers: { ...(await getAuthHeaders()) },
        })
        if (!gift_card?.code) {
          return null
        }
        return {
          code: gift_card.code,
          amount: Number(line.amount ?? 0),
        }
      } catch {
        return null
      }
    })
  )

  return resolved.filter(
    (entry): entry is AppliedGiftCard => entry !== null
  )
}
