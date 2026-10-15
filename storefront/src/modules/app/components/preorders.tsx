"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Preorder = {
  variant_id: string
  variant_title?: string | null
  product_title?: string | null
  available_at?: string | null
  eta_text?: string | null
}

/** Preorders — flagged variants with ETAs; clearing is the phone action. */
export default function Preorders({ onAuthLost }: { onAuthLost: () => void }) {
  const [rows, setRows] = useState<Preorder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ preorders: Preorder[] }>("/admin/preorders")
      setRows(res.preorders ?? [])
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

  const clear = async (variant_id: string) => {
    setBusy(variant_id)
    setError(null)
    try {
      await appFetch("/admin/preorders", {
        method: "POST",
        body: JSON.stringify({ variant_id, preorder: null }),
      })
      await load()
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not clear.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="la-card">
      <div className="la-row">
        <h2 className="la-h2">Preorders ({rows.length})</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {!loading && !rows.length ? <p className="la-muted">Nothing on preorder.</p> : null}
      {rows.map((r) => (
        <div key={r.variant_id} className="la-item">
          <p>
            <strong>{[r.product_title, r.variant_title].filter(Boolean).join(" / ")}</strong>
            <br />
            <span className="la-muted">{r.eta_text ?? ""}{r.available_at ? ` · from ${new Date(r.available_at).toLocaleDateString()}` : ""}</span>
          </p>
          <div className="la-actions">
            <button
              className="la-btn-ghost"
              disabled={busy !== null}
              onClick={() => clear(r.variant_id)}
            >
              {busy === r.variant_id ? "Clearing…" : "Clear flag"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
