"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type Summary = {
  days: number
  order_count: number
  currencies: { currency: string; revenue_minor: number; orders: number; aov_minor: number }[]
  top_products: { product_id?: string; title: string; qty: number; revenue: number }[]
}

/** Stats — KPI summary over selectable windows. Read-only by design. */
export default function Analytics({ onAuthLost }: { onAuthLost: () => void }) {
  const [data, setData] = useState<Summary | null>(null)
  const [days, setDays] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (d: number) => {
      setLoading(true)
      try {
        const res = await appFetch<Summary>(`/admin/analytics/summary?days=${d}`)
        setData(res)
        setError(null)
      } catch (e) {
        if (e instanceof AppAuthError) onAuthLost()
        else setError(e instanceof Error ? e.message : "Could not load.")
      } finally {
        setLoading(false)
      }
    },
    [onAuthLost]
  )

  useEffect(() => {
    load(days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Stats</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                className="la-btn-ghost"
                aria-pressed={days === d}
                style={days === d ? { borderColor: "#c8a24a", color: "#f3e9d2" } : undefined}
                onClick={() => {
                  setDays(d)
                  load(d)
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {error ? <p className="la-err">{error}</p> : null}
      </div>
      {data
        ? data.currencies.map((c) => (
            <div key={c.currency} className="la-card">
              <p className="la-big">{money(c.revenue_minor, c.currency)}</p>
              <p className="la-muted">
                {c.orders} orders · AOV {money(c.aov_minor, c.currency)} · {data.days}d
              </p>
            </div>
          ))
        : null}
      {data && data.top_products.length ? (
        <div className="la-card">
          <h2 className="la-h2">Top products</h2>
          {data.top_products.slice(0, 10).map((p, i) => (
            <p key={`${p.product_id ?? p.title}-${i}`}>
              {i + 1}. {p.title} — <strong>{p.qty}</strong>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
