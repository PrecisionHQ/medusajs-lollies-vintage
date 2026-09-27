"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

export type WishlistItem = {
  id: string
  product_id: string
  variant_id: string | null
  product_title: string | null
  product_handle: string | null
  product_thumbnail: string | null
  variant_title: string | null
}

/**
 * PR-07 — Wishlist reads and writes (server actions; the customer JWT stays
 * server-side). All routes 401 for guests — callers surface a login link.
 */
export async function getWishlist(): Promise<WishlistItem[] | null> {
  return sdk.client
    .fetch<{ items: WishlistItem[] }>(`/store/wishlist`, {
      method: "GET",
      headers: { ...(await getAuthHeaders()) },
    })
    .then(({ items }) => items)
    .catch(() => null)
}

export async function addToWishlist(
  productId: string,
  variantId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sdk.client.fetch(`/store/wishlist`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { product_id: productId, variant_id: variantId ?? null },
    })
    return { ok: true }
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status
    return { ok: false, error: status === 401 ? "signin" : "failed" }
  }
}

export async function removeFromWishlist(
  id: string
): Promise<{ ok: boolean }> {
  try {
    await sdk.client.fetch(`/store/wishlist`, {
      method: "DELETE",
      headers: { ...(await getAuthHeaders()) },
      body: { id },
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
