"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type OrderRow = {
  id: string
  display_id?: number
  email?: string
  total?: number
  currency_code?: string
  status?: string
  payment_status?: string
  fulfillment_status?: string
  created_at?: string
}

type OrderDetail = OrderRow & {
  subtotal?: number
  tax_total?: number
  shipping_total?: number
  discount_total?: number
  items?: {
    id: string
    title?: string
    variant_title?: string | null
    quantity?: number
    fulfilled_quantity?: number
    unit_price?: number
  }[]
  fulfillments?: {
    id: string
    status?: string
    shipped_at?: string | null
    items?: { id: string; quantity?: number }[]
  }[]
  payment_collections?: { payments?: { id: string; amount?: number; captured_at?: string | null; provider_id?: string | null }[] }[]
}

const DONE_FULFILL = ["fulfilled", "shipped", "delivered"]
const DONE_STATUS = ["canceled", "archived", "completed", "refunded"]
const DUE_PAYMENT = ["awaiting", "not_paid", "requires_action", "partially_authorized"]

/** Unknown enum values fail open to "needs attention" — right default for an owner. */
function needsAction(o: OrderRow): boolean {
  if (DONE_STATUS.includes(o.status ?? "")) return false
  const unfulfilled = !DONE_FULFILL.includes(o.fulfillment_status ?? "")
  const unpaid = DUE_PAYMENT.includes(o.payment_status ?? "") || !(o.payment_status ?? "")
  return unfulfilled || unpaid
}

type Filter = "attention" | "all" | "unfulfilled" | "unpaid"

/**
 * Orders — list, detail, fulfill + tracking, cancel, capture.
 * PWA UI over Medusa core /admin/* (see docs/parity-spike.md): no backend
 * wrapper routes. Every mutating call reloads the detail; backend workflow
 * errors (e.g. cancel-after-fulfill) surface as plain messages.
 */
export default function Orders({
  onAuthLost,
  target,
  onTargetDone,
}: {
  onAuthLost: () => void
  target?: string | null
  onTargetDone?: () => void
}) {
  const [rows, setRows] = useState<OrderRow[]>([])
  const [filter, setFilter] = useState<Filter>("attention")
  const [selected, setSelected] = useState<OrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [tracking, setTracking] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<{ id: string; label?: string }[]>([])
  const [refundAmount, setRefundAmount] = useState<Record<string, string>>({})
  const [refundReason, setRefundReason] = useState("")
  const [refundNote, setRefundNote] = useState("")

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

  const loadList = useCallback(async () => {
    try {
      const res = await appFetch<{ orders: OrderRow[] }>(
        "/admin/orders?limit=50&offset=0&order=-created_at&fields=id,display_id,email,total,currency_code,status,payment_status,fulfillment_status,created_at"
      )
      setRows(res.orders ?? [])
      setError(null)
    } catch (e) {
      fail(e)
    } finally {
      setLoading(false)
    }
  }, [fail])

  const loadDetail = useCallback(
    async (id: string) => {
      setBusy(id)
      try {
        const res = await appFetch<{ order: OrderDetail }>(
          `/admin/orders/${id}?fields=id,display_id,email,total,subtotal,tax_total,shipping_total,discount_total,currency_code,status,payment_status,fulfillment_status,created_at,*items,*fulfillments,*payment_collections,*payment_collections.payments`
        )
        setSelected(res.order)
        setError(null)
        // Refund reasons are best-effort: no reasons just means no dropdown.
        try {
          const rr = await appFetch<{ refund_reasons: { id: string; label?: string }[] }>(
            "/admin/refund-reasons?limit=100&fields=id,label"
          )
          setReasons(rr.refund_reasons ?? [])
        } catch {
          setReasons([])
        }
      } catch (e) {
        fail(e)
      } finally {
        setBusy(null)
      }
    },
    [fail]
  )

  useEffect(() => {
    loadList()
  }, [loadList])

  // Jump target from the Status board's SLA card.
  useEffect(() => {
    if (!target) return
    loadDetail(target).finally(() => onTargetDone?.())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const mutate = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      if (selected) await loadDetail(selected.id)
      await loadList()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const visible = rows.filter((o) => {
    if (filter === "all") return true
    if (filter === "attention") return needsAction(o)
    if (filter === "unfulfilled") return !DONE_FULFILL.includes(o.fulfillment_status ?? "")
    return DUE_PAYMENT.includes(o.payment_status ?? "") || !(o.payment_status ?? "")
  })

  const fulfillable =
    selected?.items
      ?.map((i) => ({
        id: i.id,
        quantity: Number(i.quantity ?? 0) - Number((i as any).fulfilled_quantity ?? 0),
      }))
      .filter((i) => i.quantity > 0) ?? []

  const payments =
    selected?.payment_collections?.flatMap((c) => c.payments ?? []) ?? []
  const uncaptured = payments.filter((p) => !p.captured_at)
  const captured = payments.filter((p) => p.captured_at)

  const toMinor = (major: string): number | null => {
    const n = Number(major.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.round(n * 100)
  }

  const label = (o: OrderRow) =>
    `#${o.display_id ?? o.id.slice(-6)} · ${o.email ?? "no email"} · ${money(Number(o.total ?? 0), o.currency_code ?? "eur")}`

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Orders ({visible.length})</h2>
          <button className="la-btn-ghost" onClick={() => { setSelected(null); loadList() }}>
            Refresh
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {(["attention", "all", "unfulfilled", "unpaid"] as Filter[]).map((f) => (
            <button
              key={f}
              className="la-btn-ghost"
              aria-pressed={filter === f}
              style={filter === f ? { borderColor: "#c8a24a", color: "#f3e9d2" } : undefined}
              onClick={() => setFilter(f)}
            >
              {f === "attention" ? `Action (${rows.filter(needsAction).length})` : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {error && !selected ? <p className="la-err">{error}</p> : null}
        {!loading && !visible.length ? <p className="la-muted">Nothing here.</p> : null}
        {visible.map((o) => (
          <div key={o.id} className="la-item">
            <button
              className="la-btn-ghost"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => loadDetail(o.id)}
            >
              {needsAction(o) ? "● " : ""}{label(o)}
              <br />
              <span className="la-muted">
                {o.fulfillment_status ?? "?"} · {o.payment_status ?? "?"} ·{" "}
                {o.created_at ? new Date(o.created_at).toLocaleString() : ""}
              </span>
            </button>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="la-card">
          <div className="la-row">
            <h2 className="la-h2">Order #{selected.display_id ?? selected.id.slice(-6)}</h2>
            <button className="la-btn-ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p className="la-big">{money(Number(selected.total ?? 0), selected.currency_code ?? "eur")}</p>
          <p className="la-muted">
            {selected.email ?? ""} · {selected.payment_status} · {selected.fulfillment_status}
          </p>
          {error ? <p className="la-err">{error}</p> : null}
          {(selected.items ?? []).map((i) => (
            <p key={i.id}>
              {Number(i.quantity ?? 0)}× {[i.title, i.variant_title].filter(Boolean).join(" / ")}
            </p>
          ))}

          <div className="la-actions">
            <button
              className="la-btn-ghost"
              disabled={busy !== null || !fulfillable.length}
              onClick={() =>
                mutate("fulfill", () =>
                  appFetch(`/admin/orders/${selected.id}/fulfillments`, {
                    method: "POST",
                    body: JSON.stringify({ items: fulfillable }),
                  })
                )
              }
            >
              {fulfillable.length ? `Fulfill (${fulfillable.reduce((n, i) => n + i.quantity, 0)})` : "Fulfilled"}
            </button>
            {uncaptured.length ? (
              <button
                className="la-btn-ghost"
                disabled={busy !== null}
                onClick={() =>
                  mutate(`capture-${uncaptured[0].id}`, () =>
                    appFetch(`/admin/payments/${uncaptured[0].id}/capture`, {
                      method: "POST",
                      body: JSON.stringify({}),
                    })
                  )
                }
              >
                Capture {money(Number(uncaptured[0].amount ?? 0), selected.currency_code ?? "eur")}
                {uncaptured[0].provider_id ? ` via ${uncaptured[0].provider_id}` : ""}
              </button>
            ) : null}
            {!DONE_STATUS.includes(selected.status ?? "") ? (
              <button
                className="la-btn-ghost"
                disabled={busy !== null}
                onClick={() =>
                  mutate("cancel", () =>
                    appFetch(`/admin/orders/${selected.id}/cancel`, {
                      method: "POST",
                      body: JSON.stringify({}),
                    })
                  )
                }
              >
                Cancel
              </button>
            ) : null}
          </div>

          {captured.map((p) => (
            <div key={p.id} className="la-item">
              <p className="la-muted">
                Paid {money(Number(p.amount ?? 0), selected.currency_code ?? "eur")}
                {p.provider_id ? ` via ${p.provider_id}` : ""} · refund:
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="la-input"
                  inputMode="decimal"
                  placeholder={((Number(p.amount ?? 0) / 100).toFixed(2))}
                  value={refundAmount[p.id] ?? ""}
                  onChange={(e) => setRefundAmount((r) => ({ ...r, [p.id]: e.target.value }))}
                />
                <button
                  className="la-btn-ghost"
                  disabled={busy !== null || toMinor(refundAmount[p.id] ?? "") === null}
                  onClick={() => {
                    const amount = toMinor(refundAmount[p.id] ?? "")
                    if (amount === null) return
                    mutate(`refund-${p.id}`, () =>
                      appFetch(`/admin/payments/${p.id}/refund`, {
                        method: "POST",
                        body: JSON.stringify({
                          amount,
                          ...(refundReason ? { refund_reason_id: refundReason } : {}),
                          ...(refundNote.trim() ? { note: refundNote.trim() } : {}),
                        }),
                      })
                    )
                  }}
                >
                  Refund
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {reasons.length ? (
                  <select
                    className="la-input"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    aria-label="Refund reason"
                  >
                    <option value="">No reason</option>
                    {reasons.map((r) => (
                      <option key={r.id} value={r.id}>{r.label ?? r.id}</option>
                    ))}
                  </select>
                ) : null}
                <input
                  className="la-input"
                  placeholder="Note (optional)"
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                />
              </div>
            </div>
          ))}

          {(selected.fulfillments ?? []).map((f) => (
            <div key={f.id} className="la-item">
              <p className="la-muted">
                Shipment {f.id.slice(-6)} · {f.status ?? ""}
                {f.shipped_at ? " · shipped" : " · not shipped"}
              </p>
              {!f.shipped_at ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="la-input"
                    placeholder="Tracking number"
                    value={tracking[f.id] ?? ""}
                    onChange={(e) => setTracking((t) => ({ ...t, [f.id]: e.target.value }))}
                  />
                  <button
                    className="la-btn-ghost"
                    disabled={busy !== null || !(tracking[f.id] ?? "").trim()}
                    onClick={() =>
                      mutate(`track-${f.id}`, () =>
                        appFetch(
                          `/admin/orders/${selected.id}/fulfillments/${f.id}/shipments`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              items: (f.items ?? []).map((i) => ({ id: i.id, quantity: i.quantity ?? 1 })),
                              labels: [{ tracking_number: (tracking[f.id] ?? "").trim() }],
                            }),
                          }
                        )
                      )
                    }
                  >
                    Ship
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {busy ? <p className="la-muted">Working…</p> : null}
        </div>
      ) : null}
    </div>
  )
}
