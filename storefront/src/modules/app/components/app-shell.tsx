"use client"

import { useCallback, useEffect, useState } from "react"
import { appLogout, getToken } from "@modules/app/backend"
import { ShellStyles } from "@modules/app/components/ui"
import LoginForm from "@modules/app/components/login-form"
import Board from "@modules/app/components/board"

/**
 * Owner PWA root — login gate, status board, service-worker registration.
 *
 * The service worker is registered here and only here (scope /app/), so
 * the storefront never sees it. Auth state is the localStorage admin JWT;
 * losing it (401/expired) drops back to the sign-in form. Moderation and
 * push-settings tabs land in the follow-up UI PR.
 */
export default function AppShell() {
  const [authed, setAuthed] = useState<boolean | null>(null)

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
        <Board onAuthLost={onAuthLost} />
      </div>
    </>
  )
}
