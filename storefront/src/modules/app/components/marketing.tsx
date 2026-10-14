"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Flow = {
  key: string
  config?: { enabled?: boolean }
  sent?: number
}

type Campaign = {
  id: string
  subject?: string
  headline?: string
  status?: string
  scheduled_at?: string | null
  sent?: number
  failed?: number
  created_at?: string
}

/**
 * Flows — automation switches with send counters, campaigns with stats,
 * test-send and two-tap send-now. Same admin endpoints as the dashboard
 * Flows/library pages, so rules stay in one place.
 */
export default function Marketing({ onAuthLost }: { onAuthLost: () => void }) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [optOuts, setOptOuts] = useState(0)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState("")
  const [armed, setArmed] = useState<string | null>(null)

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
      const [f, c] = await Promise.all([
        appFetch<{ flows: Flow[]; optOuts?: number }>("/admin/marketing/flows"),
        appFetch<{ campaigns: Campaign[] }>("/admin/marketing/campaigns"),
      ])
      setFlows(f.flows ?? [])
      setOptOuts(f.optOuts ?? 0)
      setCampaigns(c.campaigns ?? [])
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

  const toggle = async (key: string, enabled: boolean) => {
    setBusy(key)
    setError(null)
    try {
      await appFetch("/admin/marketing/flows", {
        method: "POST",
        body: JSON.stringify({ key, enabled }),
      })
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const testSend = async (id: string) => {
    const email = testEmail.trim()
    if (!email || !email.includes("@")) {
      setError("Enter a test email first.")
      return
    }
    setBusy(`test-${id}`)
    setError(null)
    try {
      await appFetch(`/admin/marketing/campaigns/${id}/test-send`, {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      setError(null)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const sendNow = async (id: string) => {
    if (armed !== id) {
      setArmed(id)
      return
    }
    setArmed(null)
    setBusy(`send-${id}`)
    setError(null)
    try {
      await appFetch(`/admin/marketing/campaigns/${id}/send-now`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const off = flows.filter((f) => f.config?.enabled === false)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Flows ({flows.length})</h2>
          <button className="la-btn-ghost" onClick={load}>Refresh</button>
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {error ? <p className="la-err">{error}</p> : null}
        <p className="la-muted">
          {off.length ? `Off: ${off.map((f) => f.key).join(", ")}` : "All on"} · {optOuts} opt-outs
        </p>
        {flows.map((f) => {
          const on = f.config?.enabled !== false
          return (
            <div key={f.key} className="la-row la-item">
              <span>
                <strong>{f.key}</strong>
                <br />
                <span className="la-muted">{f.sent ?? 0} sent</span>
              </span>
              <button
                className="la-btn-ghost"
                aria-pressed={on}
                disabled={busy !== null}
                style={!on ? undefined : { borderColor: "#c8a24a", color: "#f3e9d2" }}
                onClick={() => toggle(f.key, !on)}
              >
                {busy === f.key ? "…" : on ? "On" : "Off"}
              </button>
            </div>
          )
        })}
      </div>

      <div className="la-card">
        <h2 className="la-h2">Campaigns ({campaigns.length})</h2>
        <input
          className="la-input"
          type="email"
          placeholder="Test email for test-sends"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
        />
        {!loading && !campaigns.length ? (
          <p className="la-muted">No campaigns yet — compose on the dashboard.</p>
        ) : null}
        {campaigns.map((c) => (
          <div key={c.id} className="la-item">
            <p>
              <strong>{c.subject ?? c.headline ?? c.id.slice(-6)}</strong>
              <br />
              <span className="la-muted">
                {c.status ?? ""} · {c.sent ?? 0} sent{c.failed ? ` · ${c.failed} failed` : ""}
                {c.scheduled_at ? ` · goes ${new Date(c.scheduled_at).toLocaleString()}` : ""}
              </span>
            </p>
            <div className="la-actions">
              <button
                className="la-btn-ghost"
                disabled={busy !== null || !testEmail.trim()}
                onClick={() => testSend(c.id)}
              >
                {busy === `test-${c.id}` ? "Sending…" : "Test"}
              </button>
              {c.status !== "sent" && c.status !== "sending" ? (
                <button
                  className="la-btn-ghost"
                  disabled={busy !== null}
                  onClick={() => sendNow(c.id)}
                >
                  {busy === `send-${c.id}`
                    ? "Sending…"
                    : armed === c.id
                      ? "Tap again to send"
                      : "Send now"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {armed ? (
          <p className="la-muted">Send-now is armed — tap again to fire, or tap elsewhere to stand down.</p>
        ) : null}
      </div>
    </div>
  )
}
