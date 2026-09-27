"use client"

import { useEffect, useState } from "react"

import {
  StockSubscription,
  listMySubscriptions,
  removeMySubscription,
} from "@lib/data/availability"

/**
 * PR-06 — Shopper's stock alerts: pending (still waiting, removable) and
 * notified (email sent, history). Removal uses the authed DELETE route;
 * emailed token links use the separate unsubscribe page instead.
 */
export default function StockAlerts() {
  const [subs, setSubs] = useState<StockSubscription[] | null>(null)

  useEffect(() => {
    listMySubscriptions().then(setSubs)
  }, [])

  if (subs === null) {
    return <p className="text-base-regular">Loading…</p>
  }

  const pending = subs.filter((s) => !s.notified)
  const done = subs.filter((s) => s.notified)

  const remove = async (id: string) => {
    const res = await removeMySubscription(id)
    if (res.ok) {
      setSubs(subs.filter((s) => s.id !== id))
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <h2 className="text-xl-semi mb-2">Waiting for restock ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-base-regular">
            Nothing here. When a product is out of stock, use Notify me on its
            page and it will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-y-2">
            {pending.map((s) => (
              <li key={s.id} className="text-base-regular flex items-center gap-x-4">
                <span>
                  Variant {s.variant_id} → {s.email}
                </span>
                <button
                  onClick={() => remove(s.id)}
                  className="underline text-ui-fg-subtle"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {done.length > 0 ? (
        <div>
          <h2 className="text-xl-semi mb-2">Back in stock ({done.length})</h2>
          <ul className="flex flex-col gap-y-2">
            {done.map((s) => (
              <li key={s.id} className="text-base-regular">
                Variant {s.variant_id} — email sent
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
