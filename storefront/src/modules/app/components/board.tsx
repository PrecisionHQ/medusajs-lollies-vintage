"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"
import AttentionCard from "@modules/app/components/attention-card"
import type { TabId } from "@modules/app/features"

type Summary = {
  today: { orders: number; revenue: { currency: string; minor: number }[] }
  week: { orders: number; revenue: { currency: string; minor: number }[] }
  questions_open: number
  reviews_pending: number
  flows: { key: string; enabled: boolean }[]
  low_stock: { variant_id: string; title: string; available: number }[]
  revenue_30d?: { day: string; currency: string; minor: number }[]
  top_products?: { title: string; qty: number; currency: string; minor: number }[]
  sla?: { order_id: string; display_id: number | null; email: string | null; age_hours: number }[]
}

const last30Days = (): string[] => {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

/** Status board — mirrors the dashboard /phone page, one fetch, 60s poll. */
export default function Board({
  onAuthLost,
  onAdjust,
  onOpenOrder,
  onGotoTab,
}: {
  onAuthLost: () => void
  onAdjust: (variantId: string) => void
  onOpenOrder: (orderId: string) => void
  onGotoTab: (tab: TabId) => void
}) {
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
      <AttentionCard
        onAuthLost={onAuthLost}
        onGotoTab={onGotoTab}
        onOpenOrder={onOpenOrder}
        onAdjust={onAdjust}
      />
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
                <div key={s.variant_id} className="la-row" style={{ padding: "6px 0" }}>
                  <span>{s.title} — <strong>{s.available} left</strong></span>
                  <button className="la-btn-ghost" onClick={() => onAdjust(s.variant_id)}>
                    Fix
                  </button>
                </div>
              ))
            ) : (
              <p className="la-muted">Nothing under 5 units.</p>
            )}
          </div>
          <TrendCard series={data.revenue_30d ?? []} />
          <TopProductsCard rows={data.top_products ?? []} />
          <SlaCard rows={data.sla ?? []} onOpen={onOpenOrder} />
        </>
      ) : null}
    </div>
  )
}

/** 30d revenue bars, pure CSS. Dominant currency wins the chart; others are named below. */
function TrendCard({ series }: { series: NonNullable<Summary["revenue_30d"]> }) {
  if (!series.length) return null
  const totals = new Map<string, number>()
  for (const r of series) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.minor)
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "eur"
  const byDay = new Map(series.filter((r) => r.currency === top).map((r) => [r.day, r.minor]))
  const days = last30Days()
  const max = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0))
  const others = [...totals.entries()].filter(([c]) => c !== top)
  return (
    <div className="la-card">
      <h2 className="la-h2">30 days · {top.toUpperCase()}</h2>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 72 }} aria-hidden="true">
        {days.map((d) => {
          const v = byDay.get(d) ?? 0
          return (
            <div
              key={d}
              title={`${d}: ${(v / 100).toFixed(2)}`}
              style={{
                flex: 1,
                height: `${Math.max(3, Math.round((v / max) * 100))}%`,
                background: v ? "#c8a24a" : "#3a3226",
                borderRadius: 2,
              }}
            />
          )
        })}
      </div>
      <p className="la-muted">
        {(totals.get(top) ?? 0) / 100} {top.toUpperCase()} total
        {others.map(([c, m]) => ` · ${(m / 100).toFixed(2)} ${c.toUpperCase()}`).join("")}
      </p>
    </div>
  )
}

function TopProductsCard({ rows }: { rows: NonNullable<Summary["top_products"]> }) {
  if (!rows.length) return null
  return (
    <div className="la-card">
      <h2 className="la-h2">Top products · 30d</h2>
      {rows.map((p, i) => (
        <p key={`${p.title}-${i}`}>
          {i + 1}. {p.title} — <strong>{p.qty} sold</strong>{" "}
          <span className="la-muted">· {money(p.minor, p.currency)}</span>
        </p>
      ))}
    </div>
  )
}

function SlaCard({
  rows,
  onOpen,
}: {
  rows: NonNullable<Summary["sla"]>
  onOpen: (orderId: string) => void
}) {
  if (!rows.length) return null
  return (
    <div className="la-card">
      <h2 className="la-h2">Waiting &gt;48h ({rows.length})</h2>
      {rows.map((s) => (
        <div key={s.order_id} className="la-row" style={{ padding: "6px 0" }}>
          <span>
            #{s.display_id ?? s.order_id.slice(-6)}{s.email ? ` · ${s.email}` : ""} —{" "}
            <strong>{s.age_hours}h</strong>
          </span>
          <button className="la-btn-ghost" onClick={() => onOpen(s.order_id)}>
            Open
          </button>
        </div>
      ))}
    </div>
  )
}
