"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Bundle = {
  id: string
  title?: string | null
  name?: string | null
  status?: string | null
  components?: unknown[]
}

/** Bundles — list with component counts + delete. Composing stays dashboard-side. */
export default function Bundles({ onAuthLost }: { onAuthLost: () => void }) {
  const [rows, setRows] = useState<Bundle[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ bundles: Bundle[] }>("/admin/bundles")
      setRows(res.bundles ?? [])
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

  const remove = async (id: string) => {
    setBusy(id)
    setError(null)
    try {
      await appFetch(`/admin/bundles/${id}`, { method: "DELETE" })
      await load()
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not delete.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="la-card">
      <div className="la-row">
        <h2 className="la-h2">Bundles ({rows.length})</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {!loading && !rows.length && !error ? <p className="la-muted">No bundles.</p> : null}
      {rows.map((b) => (
        <div key={b.id} className="la-row la-item">
          <span style={{ fontSize: 14 }}>
            {b.title ?? b.name ?? b.id.slice(-6)}
            <br />
            <span className="la-muted">
              {(b.components ?? []).length} parts{b.status ? ` · ${b.status}` : ""}
            </span>
          </span>
          <button
            className="la-btn-ghost"
            style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
            disabled={busy !== null}
            onClick={() => remove(b.id)}
          >
            {busy === b.id ? "…" : "Delete"}
          </button>
        </div>
      ))}
    </div>
  )
}
