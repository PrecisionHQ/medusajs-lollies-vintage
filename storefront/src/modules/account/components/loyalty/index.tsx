"use client"

import { useEffect, useState } from "react"

import { LoyaltyState, getLoyalty, redeemLoyalty } from "@lib/data/loyalty"

/**
 * PR-13 — Points balance, redeem button (issues a single-use code), and
 * ledger history. Amounts render in major units from the burn currency.
 */
export default function Loyalty() {
  const [state, setState] = useState<LoyaltyState | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getLoyalty().then(setState)
  }, [])

  if (state === null) {
    return <p className="text-base-regular">Loading…</p>
  }

  const value = (state.burn_value_minor / 100).toFixed(2)

  const redeem = async () => {
    setBusy(true)
    const res = await redeemLoyalty()
    if (res.ok && res.code) {
      setCode(res.code)
      const next = await getLoyalty()
      setState(next)
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <p className="text-2xl-semi">{state.balance} points</p>
        <p className="text-base-regular text-ui-fg-subtle">
          Earn 1 point per unit you spend. {state.burn_threshold} points ={" "}
          {value} {state.burn_currency.toUpperCase()} off. Points expire after
          12 months of inactivity.
        </p>
      </div>
      {code ? (
        <p className="text-base-regular">
          Your code: <strong>{code}</strong> (single use — enter it at checkout)
        </p>
      ) : (
        <div>
          <button
            onClick={redeem}
            disabled={busy || state.balance < state.burn_threshold}
            className="bg-ui-fg-base text-ui-fg-on-inverted rounded px-4 py-2 disabled:opacity-50"
          >
            {busy ? "…" : `Redeem ${state.burn_threshold} points for ${value} off`}
          </button>
        </div>
      )}
      <div>
        <h2 className="text-xl-semi mb-2">History</h2>
        {state.ledger.length === 0 ? (
          <p className="text-base-regular">No points movement yet.</p>
        ) : (
          <ul className="flex flex-col gap-y-1">
            {state.ledger.map((r, i) => (
              <li key={i} className="text-base-regular">
                {r.delta > 0 ? "+" : ""}
                {r.delta} · {r.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
