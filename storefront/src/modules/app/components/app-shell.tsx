"use client"

import { useCallback, useEffect, useState } from "react"
import { appLogout, getToken } from "@modules/app/backend"
import { ShellStyles } from "@modules/app/components/ui"
import LoginForm from "@modules/app/components/login-form"
import Board from "@modules/app/components/board"
import Moderation from "@modules/app/components/moderation"
import PushSettings from "@modules/app/components/push-settings"

type Tab = "status" | "moderate" | "alerts"

/**
 * Owner PWA root — login gate, tab shell, service-worker registration.
 *
 * The service worker is registered here and only here (scope /app/), so
 * the storefront never sees it. Auth state is the localStorage admin JWT;
 * losing it (401/expired) drops back to the sign-in form.
 */
export default function AppShell() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>("status")

  useEffect(() => {
    setAuthed(!!getToken())
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/app/sw.js", { scope: "/app" }).catch(() => {})
    }
  }, [])

  const onAuthLost = useCallback(() => setAuthed(false), [])

  const logout = useCallback(async () => {
    await appLogout()
    setAuthed(false)
  }, [])

  if (authed === null) return null
  if (!authed) {
    return (
      <>
        <ShellStyles />
        <LoginForm onDone={() => setAuthed(true)} />
      </>
    )
  }

  return (
    <>
      <ShellStyles />
      <div className="la-wrap">
        <div className="la-row">
          <h1 className="la-h1">Lollies Shop</h1>
          <button className="la-btn-ghost" onClick={logout}>Sign out</button>
        </div>
        <nav className="la-tabs" aria-label="Owner app">
          {(["status", "moderate", "alerts"] as Tab[]).map((t) => (
            <button
              key={t}
              className="la-tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t === "status" ? "Status" : t === "moderate" ? "Moderate" : "Alerts"}
            </button>
          ))}
        </nav>
        {tab === "status" ? <Board onAuthLost={onAuthLost} /> : null}
        {tab === "moderate" ? <Moderation onAuthLost={onAuthLost} /> : null}
        {tab === "alerts" ? <PushSettings /> : null}
      </div>
    </>
  )
}
