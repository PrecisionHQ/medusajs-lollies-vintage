"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { backendUrl } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type Creator = {
  id: string
  name: string
  handle: string
  platform?: string | null
  commission_pct?: number | null
  code?: string | null
  status?: string | null
}

type Stat = {
  creator_id: string
  handle: string
  visits: number
  redemptions: number
  currency: string
  revenue_minor: number
  owed_minor: number
  paid_minor: number
}

type Payout = {
  id: string
  creator_id: string
  amount_minor: number
  currency: string
  note: string | null
  created_at: string | null
}

const linkFor = (handle: string) =>
  `${typeof window !== "undefined" ? window.location.origin : backendUrl()}/?utm_source=affiliate&utm_campaign=${encodeURIComponent(handle)}`

/**
 * Affiliates — creators, one-tap code minting, referral links. Same
 * promotions-API minting as the dashboard (code stored back on the
 * creator). Links copy to clipboard for sharing.
 */
export default function Affiliates({ onAuthLost }: { onAuthLost: () => void }) {
  const [rows, setRows] = useState<Creator[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payAmount, setPayAmount] = useState<Record<string, string>>({})
  const [payNote, setPayNote] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [rate, setRate] = useState("10")
  const [pct, setPct] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not load.")
    },
    [onAuthLost]
  )

  const load = useCallback(async () => {
    try {
      const [list, board, ledger] = await Promise.all([
        appFetch<{ creators: Creator[] }>("/admin/affiliates"),
        appFetch<{ rows: Stat[] }>("/admin/affiliates/stats?days=30").catch(() => ({
          rows: [],
        })),
        appFetch<{ payouts: Payout[] }>("/admin/affiliates/payouts").catch(() => ({
          payouts: [],
        })),
      ])
      setRows(list.creators ?? [])
      setStats(board.rows ?? [])
      setPayouts(ledger.payouts ?? [])
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
    const n = Number(rate.replace(",", "."))
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("Commission must be 0-100.")
      return
    }
    setBusy("add")
    setError(null)
    try {
      await appFetch("/admin/affiliates", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), handle: handle.trim(), commission_pct: n }),
      })
      setName("")
      setHandle("")
      setRate("10")
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const mint = async (c: Creator) => {
    const v = Number((pct[c.id] ?? "").replace(",", "."))
    if (!Number.isFinite(v) || v <= 0 || v > 100) {
      setError("Code percent must be 1-100.")
      return
    }
    const code = `${c.handle.toUpperCase()}${Math.round(v)}`
    setBusy(`mint-${c.id}`)
    setError(null)
    try {
      await appFetch("/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          code,
          type: "standard",
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: v,
          },
        }),
      })
      await appFetch(`/admin/affiliates/${c.id}`, {
        method: "POST",
        body: JSON.stringify({ code }),
      })
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000)
    } catch {
      setError("Copy failed — long-press the link instead.")
    }
  }

  const pay = async (c: Creator, currency: string, prefillMinor: number) => {
    const raw = (payAmount[c.id] ?? "").trim()
    const major = raw ? Number(raw.replace(",", ".")) : prefillMinor / 100
    if (!Number.isFinite(major) || major <= 0) {
      setError("Enter a valid amount (prefilled with windowed owed).")
      return
    }
    setBusy(`pay-${c.id}`)
    setError(null)
    try {
      await appFetch("/admin/affiliates/payouts", {
        method: "POST",
        body: JSON.stringify({
          creator_id: c.id,
          amount_minor: Math.round(major * 100),
          currency,
          note: payNote[c.id]?.trim() || null,
        }),
      })
      setPayAmount((m) => ({ ...m, [c.id]: "" }))
      setPayNote((m) => ({ ...m, [c.id]: "" }))
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <h2 className="la-h2">Add creator</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="la-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="la-input"
              placeholder="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
            />
            <input
              className="la-input"
              inputMode="decimal"
              placeholder="10%"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              style={{ maxWidth: 88 }}
              aria-label="Commission percent"
            />
          </div>
          {error ? <p className="la-err">{error}</p> : null}
          <button className="la-btn" disabled={busy !== null} onClick={add} style={{ width: "100%" }}>
            {busy === "add" ? "Adding…" : "Add creator"}
          </button>
        </div>
      </div>

      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Creators ({rows.length})</h2>
          <button className="la-btn-ghost" onClick={load}>Refresh</button>
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {!loading && !rows.length ? <p className="la-muted">Nobody yet — add your first creator above.</p> : null}
        {stats.length ? (
          <div className="la-item">
            <p className="la-muted">30d board</p>
            {stats.slice(0, 10).map((s) => (
              <p key={`${s.creator_id}-${s.currency}`} style={{ fontSize: 14 }}>
                <strong>@{s.handle}</strong> — {s.redemptions} × {money(s.revenue_minor, s.currency)} ·{" "}
                {money(s.owed_minor, s.currency)} owed · {money(s.paid_minor, s.currency)} paid
                <span className="la-muted"> · {s.visits} visits</span>
              </p>
            ))}
          </div>
        ) : null}
        {rows.map((c) => (
          <div key={c.id} className="la-item">
            <p>
              <strong>{c.name}</strong> <span className="la-muted">@{c.handle} · {c.commission_pct ?? 0}% · {c.status ?? ""}</span>
              <br />
              {c.code ? (
                <span>Code <strong>{c.code}</strong></span>
              ) : (
                <span className="la-muted">No code yet</span>
              )}
            </p>
            <p className="la-muted" style={{ fontSize: 12, wordBreak: "break-all" }}>
              {linkFor(c.handle)}
            </p>
            <div className="la-actions">
              {!c.code ? (
                <>
                  <input
                    className="la-input"
                    inputMode="decimal"
                    placeholder="% off"
                    value={pct[c.id] ?? ""}
                    onChange={(e) => setPct((m) => ({ ...m, [c.id]: e.target.value }))}
                    style={{ maxWidth: 88 }}
                    aria-label="Code percent"
                  />
                  <button
                    className="la-btn-ghost"
                    disabled={busy !== null}
                    onClick={() => mint(c)}
                  >
                    {busy === `mint-${c.id}` ? "…" : "Mint"}
                  </button>
                </>
              ) : null}
              <button
                className="la-btn-ghost"
                onClick={() => copy(c.id, linkFor(c.handle))}
              >
                {copied === c.id ? "Copied" : "Copy link"}
              </button>
            </div>
            <PayoutRow
              creator={c}
              stats={stats.filter((s) => s.creator_id === c.id)}
              payouts={payouts.filter((p) => p.creator_id === c.id)}
              amount={payAmount[c.id] ?? ""}
              setAmount={(v) => setPayAmount((m) => ({ ...m, [c.id]: v }))}
              note={payNote[c.id] ?? ""}
              setNote={(v) => setPayNote((m) => ({ ...m, [c.id]: v }))}
              busy={busy === `pay-${c.id}`}
              onPay={(currency, prefill) => pay(c, currency, prefill)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Per-creator ledger: windowed owed + lifetime paid (no computed balance —
 * different windows would make it lie), pay form prefilled with windowed
 * owed, recent history below.
 */
function PayoutRow({
  stats,
  payouts,
  amount,
  setAmount,
  note,
  setNote,
  busy,
  onPay,
}: {
  creator: Creator
  stats: Stat[]
  payouts: Payout[]
  amount: string
  setAmount: (v: string) => void
  note: string
  setNote: (v: string) => void
  busy: boolean
  onPay: (currency: string, prefillMinor: number) => void
}) {
  const currencies = [...new Set([...stats.map((s) => s.currency), ...payouts.map((p) => p.currency)])]
  if (!stats.length && !payouts.length) return null
  return (
    <div style={{ marginTop: 8 }}>
      {currencies.map((cur) => {
        const owed = stats.filter((s) => s.currency === cur).reduce((n, s) => n + s.owed_minor, 0)
        const paid = payouts.filter((p) => p.currency === cur).reduce((n, p) => n + p.amount_minor, 0)
        return (
          <div key={cur} style={{ marginBottom: 8 }}>
            <p className="la-muted" style={{ fontSize: 13, margin: "0 0 4px" }}>
              {cur.toUpperCase()}: {money(owed, cur)} owed · {money(paid, cur)} paid
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="la-input"
                inputMode="decimal"
                placeholder={(owed / 100).toFixed(2)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Payout amount"
              />
              <input
                className="la-input"
                placeholder="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Payout note"
              />
              <button className="la-btn-ghost" disabled={busy} onClick={() => onPay(cur, owed)}>
                {busy ? "…" : "Pay"}
              </button>
            </div>
          </div>
        )
      })}
      {payouts.slice(0, 3).map((p) => (
        <p key={p.id} className="la-muted" style={{ fontSize: 12 }}>
          {money(p.amount_minor, p.currency)}
          {p.note ? ` — ${p.note}` : ""}
        </p>
      ))}
    </div>
  )
}
