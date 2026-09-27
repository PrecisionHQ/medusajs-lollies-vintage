"use server"

import { sdk } from "@lib/config"
import { cache } from "react"
import { getAuthHeaders, getCacheDirectives, revalidateCacheTag } from "./cookies"

export type StoreReview = {
  id: string
  name: string
  rating: number
  title: string | null
  body: string
  verified: boolean
  helpful_count: number
  created_at: string
}

/**
 * PR-04 — Review reads and writes.
 *
 * Reads go through the tagged cache (purged on write). Writes are server
 * actions: POST create needs the customer JWT (httpOnly cookie, server-side
 * only), so the form never touches tokens directly. Unauthenticated writes
 * return { error: "signin" } and the UI links to login.
 */
export const getProductReviews = cache(async function (productId: string) {
  return sdk.client
    .fetch<{ reviews: StoreReview[]; count: number; average_rating: number | null }>(
      `/store/products/${productId}/reviews`,
      {
        method: "GET",
        ...(await getCacheDirectives("reviews")),
      }
    )
    .catch(() => ({ reviews: [], count: 0, average_rating: null }))
})

export async function submitReview(
  productId: string,
  input: { rating: number; title?: string; body: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sdk.client.fetch(`/store/products/${productId}/reviews`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: input,
    })
    await revalidateCacheTag("reviews")
    return { ok: true }
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status
    if (status === 401) {
      return { ok: false, error: "signin" }
    }
    return { ok: false, error: "failed" }
  }
}

export async function voteHelpful(
  productId: string,
  reviewId: string
): Promise<{ ok: boolean }> {
  try {
    await sdk.client.fetch(
      `/store/products/${productId}/reviews/${reviewId}/helpful`,
      { method: "POST" }
    )
    await revalidateCacheTag("reviews")
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
