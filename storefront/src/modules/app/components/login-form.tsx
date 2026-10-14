"use client"

import { useState } from "react"
import { appLogin } from "@modules/app/backend"
import { theme } from "@modules/app/components/ui"

/** Login gate — the only thing an unsigned visitor ever sees. */
export default function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await appLogin(email, password)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="la-wrap">
      <div className="la-card" style={{ marginTop: 48 }}>
        <h1 className="la-h1">Lollies Shop</h1>
        <p className="la-muted">Private owner app. Sign in with an admin login.</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          <input
            className="la-input"
            type="email"
            autoComplete="username"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="la-input"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="la-err" role="alert">{error}</p> : null}
          <button className="la-btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="la-muted" style={{ marginTop: 12, fontSize: 12 }}>
          On a shared phone use a private browser tab — closing it signs you out.
        </p>
      </div>
    </div>
  )
}

export { theme }
