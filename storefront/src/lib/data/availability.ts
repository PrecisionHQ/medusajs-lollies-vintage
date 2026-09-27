"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

export type StockSubscription = {
  id: string
  variant_id: string
  product_id: string
  email: string
  notified: boolean
}

/**
 * PR-06 — Stock alert reads and writes (server actions so the customer JWT
 * stays server-side for the authed calls).
 */
export async function subscribeStock(
  variantId: string,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sdk.client.fetch(`/store/availability/subscriptions`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { variant_id: variantId, email },
    })
    return { ok: true }
  } catch {
    return { ok: false, error: "failed" }
  }
}

export async function listMySubscriptions(): Promise<StockSubscription[]> {
  return sdk.client
    .fetch<{ subscriptions: StockSubscription[] }>(
      `/store/availability/subscriptions`,
      { method: "GET", headers: { ...(await getAuthHeaders()) } }
    )
    .then(({ subscriptions }) => subscriptions)
    .catch(() => [])
}

export async function unsubscribeStock(
  id: string,
  token: string
): Promise<{ ok: boolean }> {
  try {
    await sdk.client.fetch(`/store/availability/unsubscribe`, {
      method: "POST",
      body: { id, token },
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function removeMySubscription(
  id: string
): Promise<{ ok: boolean }> {
  try {
    await sdk.client.fetch(`/store/availability/subscriptions`, {
      method: "DELETE",
      headers: { ...(await getAuthHeaders()) },
      body: { id },
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
