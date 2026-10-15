"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type Spend = {
  id: string
  spend_date?: string
  source?: string
  campaign?: string | null
  amount?: number
  currency?: string
}

type RoasRow = {
  source: string
  currency: string
  spend_minor: number
  revenue_minor: number
  orders: number
  roas: number | null
}

const today = () => new Date().toISOString().slice(0, 10)

/** Spend — ad-spend ledger view + add + delete (same API as the dashboard). */
export default function Spend({ onAuthLost }: { onAuthLost: () => void }) {
  const [rows, setRows] = useState<Spend[]>([])
  const [roas, setRoas] = useState<RoasRow[]>([])
  const [unattributed, setUnattributed] = useState<{ currency: string; revenue_minor: number; orders: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [date, setDate] = useState(today())
  const [source, setSource] = useState("")
  const [campaign, setCampaign] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("eur")

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not load.")
    },
    [onAuthLost]
  )

  const load = useCallback(async () => {
    try {
      const [spendRes, roasRes] = await Promise.all([
        appFetch<{ spend: Spend[] }>("/admin/marketing/spend"),
        appFetch<{ rows: RoasRow[]; unattributed: { currency: string; revenue_minor: number; orders: number }[] }>(
          "/admin/marketing/roas?days=30"
        ).catch(() => ({ rows: [], unattributed: [] })),
      ])
      setRows(spendRes.spend ?? [])
      setRoas(roasRes.rows ?? [])
      setUnattributed(roasRes.unattributed ?? [])
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

  const add = async () => {
    const major = Number(amount.replace(",", "."))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Date must be YYYY-MM-DD.")
      return
    }
    if (!source.trim()) {
      setError("Source is required (e.g. meta, google, tiktok).")
      return
    }
    if (!Number.isFinite(major) || major <= 0) {
      setError("Amount must be more than 0.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await appFetch("/admin/marketing/spend", {
        method: "POST",
        body: JSON.stringify({
          spend_date: date,
          source: source.trim().toLowerCase(),
          campaign: campaign.trim() || null,
          amount: Math.round(major * 100),
          currency: currency.trim().toLowerCase(),
        }),
      })
      setSource("")
      setCampaign("")
      setAmount("")
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await appFetch(`/admin/marketing/spend/${id}`, { method: "DELETE" })
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <h2 className="la-h2">ROAS · 30d</h2>
        {!loading && !roas.length ? (
          <p className="la-muted">No spend or attributed revenue yet.</p>
        ) : null}
        {roas.map((r) => (
          <p key={`${r.source}-${r.currency}`} style={{ fontSize: 14 }}>
            <strong>{r.source}</strong> — {r.roas === null ? "organic" : `${r.roas.toFixed(2)}×`}
            <br />
            <span className="la-muted">
              {money(r.revenue_minor, r.currency)} / {money(r.spend_minor, r.currency)} · {r.orders} orders
            </span>
          </p>
        ))}
        {unattributed.map((u) => (
          <p key={u.currency} className="la-muted" style={{ fontSize: 13 }}>
            unattributed: {money(u.revenue_minor, u.currency)} · {u.orders} orders
          </p>
        ))}
      </div>
      <div className="la-card">
        <h2 className="la-h2">Log spend</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="la-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Spend date" />
            <input className="la-input" placeholder="eur" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency" />
          </div>
          <input className="la-input" placeholder="Source (meta, google, tiktok…)" value={source} onChange={(e) => setSource(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <input className="la-input" placeholder="Campaign (optional)" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
            <input className="la-input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
          </div>
          {error ? <p className="la-err">{error}</p> : null}
          <button className="la-btn" disabled={busy} onClick={add} style={{ width: "100%" }}>
            {busy ? "Saving…" : "Log spend"}
          </button>
        </div>
      </div>
      <div className="la-card">
        <h2 className="la-h2">Ledger ({rows.length})</h2>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {!loading && !rows.length ? <p className="la-muted">Nothing logged.</p> : null}
        {rows.map((r) => (
          <div key={r.id} className="la-row la-item">
            <span style={{ fontSize: 14 }}>
              {money(Number(r.amount ?? 0), r.currency ?? "eur")} · {r.source ?? ""}
              {r.campaign ? ` · ${r.campaign}` : ""}
              <br />
              <span className="la-muted">{r.spend_date ?? ""}</span>
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
