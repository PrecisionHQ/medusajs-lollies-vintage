"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Promo = {
  id: string
  code?: string
  status?: string
  application_method?: {
    type?: string
    value?: number
    currency_code?: string | null
  }
}

const describe = (p: Promo): string => {
  const m = p.application_method
  if (!m) return p.code ?? p.id
  const v =
    m.type === "percentage"
      ? `${m.value}%`
      : `${((m.value ?? 0) / 100).toFixed(2)} ${(m.currency_code ?? "eur").toUpperCase()}`
  return `${p.code ?? "?"} — ${v} off`
}

/**
 * Discounts — list, create (order-level % or fixed codes), activate/draft,
 * delete. Redemptions-per-code is a follow-up: core exposes budget usage on
 * campaigns, not a per-code counter the list can show, so v1 tracks the
 * codes themselves (value, status, usage cap).
 */
export default function Discounts({ onAuthLost }: { onAuthLost: () => void }) {
  const [promos, setPromos] = useState<Promo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [kind, setKind] = useState<"percentage" | "fixed">("percentage")
  const [value, setValue] = useState("")
  const [currency, setCurrency] = useState("eur")
  const [limit, setLimit] = useState("")

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
      const res = await appFetch<{ promotions: Promo[] }>(
        "/admin/promotions?limit=50&fields=id,code,status,*application_method"
      )
      setPromos(res.promotions ?? [])
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

  const create = () => {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      setError("Give the code a name (e.g. THANKS10).")
      return
    }
    if (kind === "percentage") {
      const pct = Number(value.replace(",", "."))
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        setError("Percentage must be between 0 and 100.")
        return
      }
      return mutate("create", () =>
        appFetch("/admin/promotions", {
          method: "POST",
          body: JSON.stringify({
            code: cleanCode,
            type: "standard",
            status: "active",
            application_method: {
              type: "percentage",
              target_type: "order",
              allocation: "across",
              value: pct,
            },
            ...(limit.trim() ? { limit: Number(limit) } : {}),
          }),
        }).then(() => {
          setCode("")
          setValue("")
          setLimit("")
        })
      )
    }
    const major = Number(value.replace(",", "."))
    if (!Number.isFinite(major) || major <= 0) {
      setError("Amount must be more than 0.")
      return
    }
    return mutate("create", () =>
      appFetch("/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          code: cleanCode,
          type: "standard",
          status: "active",
          application_method: {
            type: "fixed",
            target_type: "order",
            allocation: "across",
            value: Math.round(major * 100),
            currency_code: currency.trim().toLowerCase(),
          },
          ...(limit.trim() ? { limit: Number(limit) } : {}),
        }),
      }).then(() => {
        setCode("")
        setValue("")
        setLimit("")
      })
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <h2 className="la-h2">New code</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="la-input"
            placeholder="CODE (e.g. THANKS10)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
          />
          <div style={{ display: "flex", gap: 8 }}>
            {(["percentage", "fixed"] as const).map((k) => (
              <button
                key={k}
                className="la-btn-ghost"
                aria-pressed={kind === k}
                style={kind === k ? { borderColor: "#c8a24a", color: "#f3e9d2" } : undefined}
                onClick={() => setKind(k)}
              >
                {k === "percentage" ? "% off" : "Fixed"}
              </button>
            ))}
            <input
              className="la-input"
              inputMode="decimal"
              placeholder={kind === "percentage" ? "10" : "5.00"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {kind === "fixed" ? (
              <input
                className="la-input"
                placeholder="eur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                maxLength={3}
              />
            ) : null}
            <input
              className="la-input"
              inputMode="numeric"
              placeholder="Usage cap (optional)"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          {error ? <p className="la-err">{error}</p> : null}
          <button className="la-btn" disabled={busy !== null} onClick={create} style={{ width: "100%" }}>
            {busy === "create" ? "Creating…" : "Create + activate"}
          </button>
        </div>
      </div>

      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Codes ({promos.length})</h2>
          <button className="la-btn-ghost" onClick={load}>Refresh</button>
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {!loading && !promos.length ? <p className="la-muted">No codes yet.</p> : null}
        {promos.map((p) => (
          <div key={p.id} className="la-item">
            <div className="la-row">
              <p style={{ margin: 0 }}>
                <strong>{describe(p)}</strong>
                <br />
                <span className="la-muted">{p.status ?? ""}</span>
              </p>
            </div>
            <div className="la-actions">
              <button
                className="la-btn-ghost"
                disabled={busy !== null}
                onClick={() =>
                  mutate(`toggle-${p.id}`, () =>
                    appFetch(`/admin/promotions/${p.id}`, {
                      method: "POST",
                      body: JSON.stringify({
                        status: p.status === "active" ? "draft" : "active",
                      }),
                    })
                  )
                }
              >
                {p.status === "active" ? "Pause" : "Activate"}
              </button>
              <button
                className="la-btn-ghost"
                disabled={busy !== null}
                onClick={() =>
                  mutate(`del-${p.id}`, () =>
                    appFetch(`/admin/promotions/${p.id}`, { method: "DELETE" })
                  )
                }
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
