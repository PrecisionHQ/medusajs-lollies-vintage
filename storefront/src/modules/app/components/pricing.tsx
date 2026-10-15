"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Missing = {
  variant_id?: string
  sku?: string | null
  product?: string | null
  missing_currencies?: string[]
}

/**
 * Pricing — variants missing prices in one or more currencies (the audit's
 * actionable output), each jumping to Catalog. Read-only otherwise: bulk
 * price strategy stays on the dashboard.
 */
export default function Pricing({
  onAuthLost,
  onAdjust,
}: {
  onAuthLost: () => void
  onAdjust: (variantId: string) => void
}) {
  const [rows, setRows] = useState<Missing[]>([])
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ missing: Missing[]; missing_count: number }>(
        "/admin/pricing/audit"
      )
      setRows(res.missing ?? [])
      setCount(res.missing_count ?? 0)
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
  }, [load])

  return (
    <div className="la-card">
      <div className="la-row">
        <h2 className="la-h2">Missing prices ({count})</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {!loading && !rows.length && !error ? (
        <p className="la-muted">Every variant is priced in every currency.</p>
      ) : null}
      {rows.map((r, i) => (
        <div key={r.variant_id ?? i} className="la-row la-item">
          <span style={{ fontSize: 14 }}>
            {[r.product, r.sku].filter(Boolean).join(" · ")}
            <br />
            <span className="la-muted">missing: {(r.missing_currencies ?? []).join(", ").toUpperCase()}</span>
          </span>
          {r.variant_id ? (
            <button
              className="la-btn-ghost"
              style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
              onClick={() => onAdjust(r.variant_id as string)}
            >
              Fix
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
