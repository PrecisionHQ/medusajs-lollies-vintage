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
      const [list, board] = await Promise.all([
        appFetch<{ creators: Creator[] }>("/admin/affiliates"),
        appFetch<{ rows: Stat[] }>("/admin/affiliates/stats?days=30").catch(() => ({
          rows: [],
        })),
      ])
      setRows(list.creators ?? [])
      setStats(board.rows ?? [])
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
                {money(s.owed_minor, s.currency)} owed
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
          </div>
        ))}
      </div>
    </div>
  )
}
