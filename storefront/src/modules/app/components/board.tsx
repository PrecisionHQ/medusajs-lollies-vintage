"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type Summary = {
  today: { orders: number; revenue: { currency: string; minor: number }[] }
  week: { orders: number; revenue: { currency: string; minor: number }[] }
  questions_open: number
  reviews_pending: number
  flows: { key: string; enabled: boolean }[]
  low_stock: { variant_id: string; title: string; available: number }[]
}

/** Status board — mirrors the dashboard /phone page, one fetch, 60s poll. */
export default function Board({ onAuthLost }: { onAuthLost: () => void }) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  )

  const load = useCallback(async () => {
    try {
      const res = await appFetch<Summary>("/admin/phone/summary")
      setData(res)
      setError(null)
    } catch (e) {
      if (e instanceof AppAuthError) {
        onAuthLost()
        return
      }
      // Offline with a stale render is fine — keep last good payload.
      if (!data) setError(e instanceof Error ? e.message : "Could not load.")
    } finally {
      setLoading(false)
    }
  }, [data, onAuthLost])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    const on = () => {
      setOffline(!navigator.onLine)
      if (navigator.onLine) load()
    }
    window.addEventListener("online", on)
    window.addEventListener("offline", on)
    return () => {
      clearInterval(id)
      window.removeEventListener("online", on)
      window.removeEventListener("offline", on)
    }
  }, [load])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {offline ? (
        <div className="la-card">
          <p className="la-muted">Offline — showing the last loaded status.</p>
        </div>
      ) : null}
      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Shop status</h2>
          <button className="la-btn-ghost" onClick={load}>Refresh</button>
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {error ? <p className="la-err">{error}</p> : null}
      </div>
      {data ? (
        <>
          <div className="la-card">
            <h2 className="la-h2">Today · {data.today.orders} orders</h2>
            {data.today.revenue.map((r) => (
              <p key={r.currency} className="la-big">{money(r.minor, r.currency)}</p>
            ))}
            <p className="la-muted">
              7 days: {data.week.orders} orders
              {data.week.revenue.map((r) => ` · ${money(r.minor, r.currency)}`)}
            </p>
          </div>
          <div className="la-card">
            <h2 className="la-h2">Needs you</h2>
            <p>{data.questions_open} open questions · {data.reviews_pending} pending reviews</p>
            <p className="la-muted">
              Flows off:{" "}
              {data.flows.filter((f) => !f.enabled).length
                ? data.flows.filter((f) => !f.enabled).map((f) => f.key).join(", ")
                : "none — all on"}
            </p>
          </div>
          <div className="la-card">
            <h2 className="la-h2">Stock alerts ({data.low_stock.length})</h2>
            {data.low_stock.length ? (
              data.low_stock.map((s) => (
                <p key={s.variant_id}>{s.title} — <strong>{s.available} left</strong></p>
              ))
            ) : (
              <p className="la-muted">Nothing under 5 units.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
