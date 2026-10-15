"use client"

import { useCallback, useEffect, useState } from "react"
import { appLogout, getToken } from "@modules/app/backend"
import { ShellStyles } from "@modules/app/components/ui"
import LoginForm from "@modules/app/components/login-form"
import Board from "@modules/app/components/board"
import Orders from "@modules/app/components/orders"
import Discounts from "@modules/app/components/discounts"
import Catalog from "@modules/app/components/catalog"
import Customers from "@modules/app/components/customers"
import Returns from "@modules/app/components/returns"
import Marketing from "@modules/app/components/marketing"
import Moderation from "@modules/app/components/moderation"
import PushSettings from "@modules/app/components/push-settings"

type Tab = "status" | "orders" | "discounts" | "catalog" | "customers" | "returns" | "flows" | "moderate" | "alerts"

const TAB_LABELS: Record<Tab, string> = {
  status: "Status",
  orders: "Orders",
  discounts: "Codes",
  catalog: "Catalog",
  customers: "Clients",
  returns: "Returns",
  flows: "Flows",
  moderate: "Moderate",
  alerts: "Alerts",
}

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
  // Stock-alert "Fix" jumps here with the variant preselected.
  const [catalogTarget, setCatalogTarget] = useState<string | null>(null)
  // SLA "Open" jumps here with the order preselected.
  const [ordersTarget, setOrdersTarget] = useState<string | null>(null)

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
        <nav className="la-tabs" aria-label="Owner app" role="tablist">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              className="la-tab"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
        {tab === "status" ? (
          <Board
            onAuthLost={onAuthLost}
            onAdjust={(variantId) => {
              setCatalogTarget(variantId)
              setTab("catalog")
            }}
            onOpenOrder={(orderId) => {
              setOrdersTarget(orderId)
              setTab("orders")
            }}
            onGotoTab={setTab}
          />
        ) : null}
        {tab === "orders" ? (
          <Orders
            onAuthLost={onAuthLost}
            target={ordersTarget}
            onTargetDone={() => setOrdersTarget(null)}
          />
        ) : null}
        {tab === "discounts" ? <Discounts onAuthLost={onAuthLost} /> : null}
        {tab === "catalog" ? (
          <Catalog
            onAuthLost={onAuthLost}
            target={catalogTarget}
            onTargetDone={() => setCatalogTarget(null)}
          />
        ) : null}
        {tab === "customers" ? <Customers onAuthLost={onAuthLost} /> : null}
        {tab === "returns" ? <Returns onAuthLost={onAuthLost} /> : null}
        {tab === "flows" ? <Marketing onAuthLost={onAuthLost} /> : null}
        {tab === "moderate" ? <Moderation onAuthLost={onAuthLost} /> : null}
        {tab === "alerts" ? <PushSettings /> : null}
      </div>
    </>
  )
}
