"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

export type LoyaltyLedgerRow = {
  delta: number
  reason: string
  order_id: string | null
  expires_at: string | null
  created_at: string
}

export type LoyaltyState = {
  balance: number
  burn_threshold: number
  burn_value_minor: number
  burn_currency: string
  ledger: LoyaltyLedgerRow[]
}

/**
 * PR-13 — Loyalty reads and redemption (server actions; JWT stays server-side).
 */
export async function getLoyalty(): Promise<LoyaltyState | null> {
  return sdk.client
    .fetch<LoyaltyState>(`/store/loyalty`, {
      method: "GET",
      headers: { ...(await getAuthHeaders()) },
    })
    .catch(() => null)
}

export async function redeemLoyalty(): Promise<{ ok: boolean; code?: string; error?: string }> {
  try {
    const res = await sdk.client.fetch<{ code: string }>(`/store/loyalty/redeem`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
    })
    return { ok: true, code: res.code }
  } catch {
    return { ok: false, error: "failed" }
  }
}

/** Share-to-earn (#13): guests get signin, authed earn (or duplicate/cap). */
export async function earnShare(
  productId: string
): Promise<{ ok: boolean; points?: number; duplicate?: boolean; error?: string }> {
  try {
    const res = await sdk.client.fetch<{ points: number; duplicate?: boolean }>(
      `/store/loyalty/share-earn`,
      {
        method: "POST",
        headers: { ...(await getAuthHeaders()) },
        body: { product_id: productId },
      }
    )
    return { ok: true, points: res.points, duplicate: res.duplicate }
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status
    if (status === 401) {
      return { ok: false, error: "signin" }
    }
    if (status === 429) {
      return { ok: false, error: "capped" }
    }
    return { ok: false, error: "failed" }
  }
}
