"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Settings = {
  earn_per_major?: number | null
  burn_threshold?: number | null
  burn_value_minor?: number | null
  burn_currency?: string | null
  expiry_months?: number | null
}

const FIELDS: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "earn_per_major", label: "Points per €1", hint: "Whole number, 0 disables earning" },
  { key: "burn_threshold", label: "Redeem from (points)", hint: "Balance needed before rewards unlock" },
  { key: "burn_value_minor", label: "Reward value (cents)", hint: "e.g. 500 = €5.00" },
  { key: "expiry_months", label: "Expiry (months)", hint: "0 = never expires" },
]

/** Loyalty — program settings view + edit, accounts outstanding count. */
export default function Loyalty({ onAuthLost }: { onAuthLost: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{
        settings: Settings
        accounts: number
        outstanding_points: number
      }>("/admin/loyalty")
      setSettings(res.settings ?? null)
      setAccounts(res.accounts ?? 0)
      setOutstanding(res.outstanding_points ?? 0)
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

  const save = async () => {
    const body: Record<string, number> = {}
    for (const [k, v] of Object.entries(draft)) {
      if (!v.trim()) continue
      const n = Number(v.replace(",", "."))
      if (!Number.isFinite(n) || n < 0) {
        setError(`${k} must be 0 or more.`)
        return
      }
      body[k] = Math.floor(n)
    }
    if (!Object.keys(body).length) {
      setError("Change a value first.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await appFetch<{ settings: Settings }>("/admin/loyalty", {
        method: "POST",
        body: JSON.stringify(body),
      })
      setSettings(res.settings ?? null)
      setDraft({})
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="la-card">
      <div className="la-row">
        <h2 className="la-h2">Loyalty</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {settings ? (
        <>
          <p className="la-muted">
            {accounts} accounts · {outstanding} points outstanding
            {settings.burn_currency ? ` · rewards in ${settings.burn_currency.toUpperCase()}` : ""}
          </p>
          {FIELDS.map((f) => (
            <div key={f.key} className="la-row" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 14, flex: 1 }}>
                {f.label}
                <br />
                <span className="la-muted">now: {String(settings[f.key] ?? "—")} · {f.hint}</span>
              </span>
              <input
                className="la-input"
                inputMode="numeric"
                style={{ maxWidth: 96 }}
                placeholder={String(settings[f.key] ?? "")}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                aria-label={f.label}
              />
            </div>
          ))}
          <button className="la-btn" disabled={busy} onClick={save} style={{ width: "100%" }}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </>
      ) : null}
    </div>
  )
}
