"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type Provider = {
  id: string
  live: boolean
  tx?: number
  captured?: number
  refunded?: number
  currency?: string
}

type Tx = {
  id: string
  provider: string
  amount: number
  authorized: number
  captured: number
  refunded: number
  currency: string
  order_id: string | null
  order_display: number | string | null
  email: string | null
  created_at: string | null
}

/**
 * Money — provider health, recent transactions, stuck queue. Reads the
 * overview aggregator (same contract as every other board: fail-open,
 * bounded, per-currency). Stuck rows jump to the order; capture/refund
 * actions live on the order detail itself.
 */
export default function Money({
  onAuthLost,
  onOpenOrder,
}: {
  onAuthLost: () => void
  onOpenOrder: (orderId: string) => void
}) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [stuck, setStuck] = useState<Tx[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ providers: Provider[]; transactions: Tx[]; stuck: Tx[] }>(
        "/admin/payments/overview"
      )
      setProviders(res.providers ?? [])
      setTxs(res.transactions ?? [])
      setStuck(res.stuck ?? [])
      setError(null)
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not load.")
    } finally {
      setLoading(false)
    }
  }, [onAuthLost])

  useEffect(() => {
    load()
    const id = setInterval(load, 300_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Providers · 30d</h2>
          <button className="la-btn-ghost" onClick={load}>Refresh</button>
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {error ? <p className="la-err">{error}</p> : null}
        {providers.map((p) => (
          <div key={p.id} className="la-row la-item">
            <span>
              <span style={{ color: p.live ? "#8fc39a" : "#e07856" }}>●</span> {p.id}
              <br />
              <span className="la-muted">
                {p.tx ?? 0} payments · {money(p.captured ?? 0, p.currency ?? "eur")} in
                {(p.refunded ?? 0) > 0 ? ` · ${money(p.refunded ?? 0, p.currency ?? "eur")} out` : ""}
                {!p.live && p.id !== "manual" ? " · keys missing" : ""}
              </span>
            </span>
          </div>
        ))}
        {!loading && !providers.length && !error ? (
          <p className="la-muted">No providers configured — checkout is on manual payment.</p>
        ) : null}
      </div>

      {stuck.length ? (
        <div className="la-card">
          <h2 className="la-h2">Stuck ({stuck.length})</h2>
          {stuck.map((t) => (
            <div key={t.id} className="la-row la-item">
              <span style={{ fontSize: 14 }}>
                #{t.order_display ?? t.id.slice(-6)} · {money(t.amount, t.currency)} · {t.provider}
              </span>
              {t.order_id ? (
                <button
                  className="la-btn-ghost"
                  style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
                  onClick={() => onOpenOrder(t.order_id as string)}
                >
                  Open
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="la-card">
        <h2 className="la-h2">Latest</h2>
        {!loading && !txs.length && !error ? <p className="la-muted">Nothing yet.</p> : null}
        {txs.slice(0, 20).map((t) => (
          <p key={t.id} style={{ fontSize: 14 }}>
            {money(t.amount, t.currency)} · {t.provider}
            {t.refunded > 0 ? ` · ${money(t.refunded, t.currency)} back` : ""}
            <br />
            <span className="la-muted">
              #{t.order_display ?? t.id.slice(-6)}{t.email ? ` · ${t.email}` : ""}
              {t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ""}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}
