"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type ReturnRow = {
  id: string
  status?: string
  order_id?: string
  display_id?: number
  created_at?: string
  items?: { id: string; title?: string; quantity?: number; received_quantity?: number }[]
}

const OPEN = ["requested", "confirmed", "open", "pending"]

/**
 * Returns — open requests with items, receive-all (initiate + confirm
 * chained; confirmation executes the restock per the return's policy),
 * cancel. Partial/per-item receive is a follow-up — v1 covers the common
 * case of the whole parcel arriving at once.
 */
export default function Returns({ onAuthLost }: { onAuthLost: () => void }) {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof AppAuthError) {
        onAuthLost()
        return
      }
      setError(e instanceof Error ? e.message : "Could not load.")
    },
    [onAuthLost]
  )

  const load = useCallback(async () => {
    try {
      const r = await appFetch<{ returns: ReturnRow[] }>(
        "/admin/returns?limit=50&offset=0&order=-created_at&fields=id,status,order_id,created_at,*items"
      )
      setRows(r.returns ?? [])
      setError(null)
    } catch (e) {
      fail(e)
    } finally {
      setLoading(false)
    }
  }, [fail])

  useEffect(() => {
    load()
  }, [load])

  const mutate = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const receiveAll = (id: string) =>
    mutate(`recv-${id}`, async () => {
      await appFetch(`/admin/returns/${id}/receive`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      await appFetch(`/admin/returns/${id}/receive/confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    })

  const visible = showAll ? rows : rows.filter((r) => OPEN.includes(r.status ?? "") || !(r.status ?? ""))

  return (
    <div className="la-card">
      <div className="la-row">
        <h2 className="la-h2">Returns ({visible.length})</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      <div style={{ marginTop: 8 }}>
        <button
          className="la-btn-ghost"
          aria-pressed={showAll}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? "Open only" : "Show all"}
        </button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {!loading && !visible.length ? <p className="la-muted">No returns here.</p> : null}
      {visible.map((r) => (
        <div key={r.id} className="la-item">
          <p>
            <strong>Return {r.id.slice(-6)}</strong>{" "}
            <span className="la-muted">· {r.status ?? "?"}{r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ""}</span>
          </p>
          {(r.items ?? []).map((i) => (
            <p key={i.id} className="la-muted">
              {Number(i.quantity ?? 0)}× {i.title ?? i.id.slice(-6)}
              {Number(i.received_quantity ?? 0) > 0 ? ` (${i.received_quantity} received)` : ""}
            </p>
          ))}
          <div className="la-actions">
            <button
              className="la-btn-ghost"
              disabled={busy !== null}
              onClick={() => receiveAll(r.id)}
            >
              {busy === `recv-${r.id}` ? "Receiving…" : "Receive all"}
            </button>
            <button
              className="la-btn-ghost"
              disabled={busy !== null}
              onClick={() =>
                mutate(`cancel-${r.id}`, () =>
                  appFetch(`/admin/returns/${r.id}/cancel`, {
                    method: "POST",
                    body: JSON.stringify({}),
                  })
                )
              }
            >
              Cancel
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
