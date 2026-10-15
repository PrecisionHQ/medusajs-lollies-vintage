"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Channel = {
  id: string
  name?: string
  metadata?: { platform?: string; utm_source?: string } | null
}

const feedFor = (platform?: string | null): string | null => {
  if (platform === "tiktok") return "/feeds/tiktok"
  if (platform === "google" || platform === "facebook" || platform === "instagram")
    return "/feeds/google"
  return null
}

/**
 * Channels — registry status: platform, attribution key, feed URL.
 * Managing (create/delete/availability) stays dashboard-side; this card
 * answers 'where do we sell and is each feed wired'. ROAS lands in C3.
 */
export default function Channels({ onAuthLost }: { onAuthLost: () => void }) {
  const [rows, setRows] = useState<Channel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ sales_channels: Channel[] }>(
        "/admin/sales-channels?fields=id,name,metadata"
      )
      setRows(res.sales_channels ?? [])
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
        <h2 className="la-h2">Channels ({rows.length})</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {!loading && !rows.length && !error ? <p className="la-muted">No channels yet.</p> : null}
      {rows.map((c) => {
        const meta = c.metadata ?? {}
        const feed = feedFor(meta.platform)
        return (
          <div key={c.id} className="la-item">
            <p>
              <strong>{c.name}</strong>
              <br />
              <span className="la-muted">
                {meta.platform ?? "?"}
                {meta.utm_source ? ` · utm ${meta.utm_source}` : " · unattributed"}
                {feed ? ` · ${feed}` : ""}
              </span>
            </p>
          </div>
        )
      })}
    </div>
  )
}
