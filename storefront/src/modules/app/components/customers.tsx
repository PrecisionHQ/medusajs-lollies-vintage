"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type Customer = {
  id: string
  email?: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  created_at?: string
}

type CustOrder = {
  id: string
  display_id?: number
  total?: number
  currency_code?: string
  status?: string
  created_at?: string
}

const nameOf = (c: Customer) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email?.split("@")[0] || "Customer"

/**
 * Customers — search, detail with contact links, order history + lifetime
 * value. Search filters client-side over the newest 100: the endpoint's
 * server filters vary, but name/email matching locally is exact and
 * predictable on a phone.
 */
export default function Customers({ onAuthLost }: { onAuthLost: () => void }) {
  const [all, setAll] = useState<Customer[]>([])
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<CustOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

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

  useEffect(() => {
    appFetch<{ customers: Customer[] }>(
      "/admin/customers?limit=100&offset=0&order=-created_at&fields=id,email,first_name,last_name,phone,created_at"
    )
      .then((r) => setAll(r.customers ?? []))
      .catch(fail)
      .finally(() => setLoading(false))
  }, [fail])

  const open = async (c: Customer) => {
    setSelected(c)
    setOrders([])
    setBusy(true)
    setError(null)
    try {
      const r = await appFetch<{ orders: CustOrder[] }>(
        `/admin/orders?limit=50&customer_id=${c.id}&order=-created_at&fields=id,display_id,total,currency_code,status,created_at`
      )
      setOrders(r.orders ?? [])
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? all.filter((c) =>
        [c.email, c.first_name, c.last_name, c.phone].some((f) =>
          (f ?? "").toLowerCase().includes(q)
        )
      )
    : all

  const lifetime = orders.reduce((n, o) => n + Number(o.total ?? 0), 0)
  const currency = orders[0]?.currency_code ?? "eur"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <h2 className="la-h2">Customers ({visible.length})</h2>
        <input
          className="la-input"
          placeholder="Name, email or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading ? <p className="la-muted">Loading…</p> : null}
        {visible.map((c) => (
          <div key={c.id} className="la-item">
            <button
              className="la-btn-ghost"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => open(c)}
            >
              {nameOf(c)}
              <br />
              <span className="la-muted">{c.email ?? ""}</span>
            </button>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="la-card">
          <div className="la-row">
            <h2 className="la-h2">{nameOf(selected)}</h2>
            <button className="la-btn-ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p className="la-muted">{selected.email ?? ""}{selected.phone ? ` · ${selected.phone}` : ""}</p>
          <div className="la-actions">
            {selected.email ? (
              <a className="la-btn-ghost" style={{ textDecoration: "none", textAlign: "center" }} href={`mailto:${selected.email}`}>
                Email
              </a>
            ) : null}
            {selected.phone ? (
              <a className="la-btn-ghost" style={{ textDecoration: "none", textAlign: "center" }} href={`tel:${selected.phone}`}>
                Call
              </a>
            ) : null}
          </div>
          <p style={{ marginTop: 8 }}>
            <strong>{orders.length} orders · {money(lifetime, currency)} lifetime</strong>
          </p>
          {busy ? <p className="la-muted">Loading orders…</p> : null}
          {error ? <p className="la-err">{error}</p> : null}
          {orders.map((o) => (
            <p key={o.id} className="la-muted">
              #{o.display_id ?? o.id.slice(-6)} · {money(Number(o.total ?? 0), o.currency_code ?? "eur")} · {o.status ?? ""}
              {o.created_at ? ` · ${new Date(o.created_at).toLocaleDateString()}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
