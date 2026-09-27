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
