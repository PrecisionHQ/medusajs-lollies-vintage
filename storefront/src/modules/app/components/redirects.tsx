"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Redirect = {
  id: string
  from?: string
  to?: string
  status?: number | string | null
}

/** Redirects — list + add (dedupes server-side) + delete. */
export default function Redirects({ onAuthLost }: { onAuthLost: () => void }) {
  const [rows, setRows] = useState<Redirect[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ redirects: Redirect[] }>("/admin/redirects")
      setRows(res.redirects ?? [])
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

  const add = async () => {
    if (!from.trim().startsWith("/") || !to.trim()) {
      setError("From must be a path (/old) and To must not be empty.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await appFetch("/admin/redirects", {
        method: "POST",
        body: JSON.stringify({ from: from.trim(), to: to.trim(), status: 301 }),
      })
      setFrom("")
      setTo("")
      await load()
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await appFetch(`/admin/redirects/${id}`, { method: "DELETE" })
      await load()
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not delete.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <h2 className="la-h2">New redirect</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="la-input" placeholder="/old-path" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="la-input" placeholder="/new-path or https://…" value={to} onChange={(e) => setTo(e.target.value)} />
          {error ? <p className="la-err">{error}</p> : null}
          <button className="la-btn" disabled={busy} onClick={add} style={{ width: "100%" }}>
            Add 301
          </button>
        </div>
      </div>
      <div className="la-card">
        <h2 className="la-h2">Redirects ({rows.length})</h2>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {!loading && !rows.length ? <p className="la-muted">None.</p> : null}
        {rows.map((r) => (
          <div key={r.id} className="la-row la-item">
            <span style={{ fontSize: 14 }}>
              {r.from} → {r.to}
              <br />
              <span className="la-muted">{r.status ?? ""}</span>
            </span>
            <button
              className="la-btn-ghost"
              style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
              disabled={busy}
              onClick={() => remove(r.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
