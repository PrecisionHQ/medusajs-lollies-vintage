"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Zone = {
  id: string
  name?: string | null
  fulfillment_set?: string | null
  options?: { id: string; name?: string | null; price_type?: string | null }[]
}

/** Shipping — zones + options reference. Configuring rates stays dashboard-side. */
export default function Shipping({ onAuthLost }: { onAuthLost: () => void }) {
  const [zones, setZones] = useState<Zone[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ zones: Zone[] }>("/admin/shipping")
      setZones(res.zones ?? [])
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
        <h2 className="la-h2">Shipping zones ({zones.length})</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {!loading && !zones.length && !error ? <p className="la-muted">No zones.</p> : null}
      {zones.map((z) => (
        <div key={z.id} className="la-item">
          <p>
            <strong>{z.name ?? z.id.slice(-6)}</strong>
            {z.fulfillment_set ? <span className="la-muted"> · {z.fulfillment_set}</span> : null}
          </p>
          {(z.options ?? []).map((o) => (
            <p key={o.id} className="la-muted" style={{ fontSize: 14 }}>
              {o.name ?? o.id.slice(-6)}{o.price_type ? ` · ${o.price_type}` : ""}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}
