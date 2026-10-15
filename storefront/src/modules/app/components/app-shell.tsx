"use client"

import { useCallback, useEffect, useState } from "react"
import { appLogout, getToken } from "@modules/app/backend"
import { ShellStyles } from "@modules/app/components/ui"
import LoginForm from "@modules/app/components/login-form"
import Board from "@modules/app/components/board"
import Orders from "@modules/app/components/orders"
import Money from "@modules/app/components/money"
import Discounts from "@modules/app/components/discounts"
import Catalog from "@modules/app/components/catalog"
import Customers from "@modules/app/components/customers"
import Returns from "@modules/app/components/returns"
import Marketing from "@modules/app/components/marketing"
import Moderation from "@modules/app/components/moderation"
import PushSettings from "@modules/app/components/push-settings"
import Preorders from "@modules/app/components/preorders"
import Analytics from "@modules/app/components/analytics"
import Spend from "@modules/app/components/spend"
import Pricing from "@modules/app/components/pricing"
import Loyalty from "@modules/app/components/loyalty"
import Bundles from "@modules/app/components/bundles"
import Redirects from "@modules/app/components/redirects"
import Seo from "@modules/app/components/seo"
import Shipping from "@modules/app/components/shipping"
import Channels from "@modules/app/components/channels"
import Affiliates from "@modules/app/components/affiliates"
import FeaturesScreen from "@modules/app/components/features-screen"
import {
  TAB_LABELS,
  loadEnabled,
  saveEnabled,
  visibleWithPermissions,
  type TabId,
} from "@modules/app/features"
import { appFetch } from "@modules/app/backend"

/**
 * Owner PWA root — login gate, tab shell, service-worker registration.
 *
 * Tabs render from the feature registry: curated by default, Labs behind
 * the Features screen (gear). gotoTab auto-enables a disabled tab, so an
 * attention row targeting a hidden capability reveals it on demand instead
 * of dead-ending. The service worker is registered here and only here
 * (scope /app/), so the storefront never sees it. Auth state is the
 * localStorage admin JWT; losing it (401/expired) drops back to sign-in.
 */
export default function AppShell() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<TabId>("status")
  const [view, setView] = useState<"tabs" | "features">("tabs")
  const [enabled, setEnabled] = useState<TabId[]>(() =>
    typeof window === "undefined" ? ["status"] : loadEnabled()
  )
  // Phase 5 (R2): null = unknown (flag off / unreachable) → show all.
  const [granted, setGranted] = useState<Set<string> | null>(null)
  // Stock-alert "Fix" jumps here with the variant preselected.
  const [catalogTarget, setCatalogTarget] = useState<string | null>(null)
  // SLA "Open" jumps here with the order preselected.
  const [ordersTarget, setOrdersTarget] = useState<string | null>(null)

  useEffect(() => {
    setAuthed(!!getToken())
    setEnabled(loadEnabled())
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/app/sw.js", { scope: "/app" }).catch(() => {})
    }
    appFetch<unknown>("/admin/rbac/me/permissions")
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.permissions ?? null
        if (Array.isArray(list)) setGranted(new Set(list.map(String)))
      })
      .catch(() => {
        // Flag off or unreachable: fail open to today's show-everything.
      })
  }, [])

  const onAuthLost = useCallback(() => setAuthed(false), [])

  const logout = useCallback(async () => {
    await appLogout()
    setAuthed(false)
  }, [])

  const changeFeatures = useCallback((tabs: TabId[]) => {
    setEnabled(tabs)
    saveEnabled(tabs)
  }, [])

  const gotoTab = useCallback(
    (t: TabId) => {
      setEnabled((cur) => {
        if (cur.includes(t)) return cur
        const next = [...cur, t]
        saveEnabled(next)
        return next
      })
      setTab(t)
      setView("tabs")
    },
    []
  )

  if (authed === null) return null
  if (!authed) {
    return (
      <>
        <ShellStyles />
        <LoginForm onDone={() => setAuthed(true)} />
      </>
    )
  }

  if (view === "features") {
    return (
      <>
        <ShellStyles />
        <FeaturesScreen
          enabled={enabled}
          onChange={changeFeatures}
          onBack={() => setView("tabs")}
        />
      </>
    )
  }

  return (
    <>
      <ShellStyles />
      <div className="la-wrap">
        <div className="la-row">
          <h1 className="la-h1">Lollies Shop</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="la-btn-ghost"
              onClick={() => setView("features")}
              aria-label="Features"
              title="Features"
            >
              ⚙
            </button>
            <button className="la-btn-ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
        <nav className="la-tabs" aria-label="Owner app" role="tablist">
          {(Object.keys(TAB_LABELS) as TabId[])
            .filter((t) => enabled.includes(t))
            .filter((t) => visibleWithPermissions([t], granted).length > 0)
            .map((t) => (
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
              gotoTab("catalog")
            }}
            onOpenOrder={(orderId) => {
              setOrdersTarget(orderId)
              gotoTab("orders")
            }}
            onGotoTab={gotoTab}
          />
        ) : null}
        {tab === "orders" ? (
          <Orders
            onAuthLost={onAuthLost}
            target={ordersTarget}
            onTargetDone={() => setOrdersTarget(null)}
          />
        ) : null}
        {tab === "money" ? (
          <Money
            onAuthLost={onAuthLost}
            onOpenOrder={(orderId) => {
              setOrdersTarget(orderId)
              gotoTab("orders")
            }}
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
        {tab === "preorders" ? <Preorders onAuthLost={onAuthLost} /> : null}
        {tab === "analytics" ? <Analytics onAuthLost={onAuthLost} /> : null}
        {tab === "spend" ? <Spend onAuthLost={onAuthLost} /> : null}
        {tab === "pricing" ? (
          <Pricing
            onAuthLost={onAuthLost}
            onAdjust={(variantId) => {
              setCatalogTarget(variantId)
              gotoTab("catalog")
            }}
          />
        ) : null}
        {tab === "loyalty" ? <Loyalty onAuthLost={onAuthLost} /> : null}
        {tab === "bundles" ? <Bundles onAuthLost={onAuthLost} /> : null}
        {tab === "redirects" ? <Redirects onAuthLost={onAuthLost} /> : null}
        {tab === "seo" ? <Seo onAuthLost={onAuthLost} /> : null}
        {tab === "shipping" ? <Shipping onAuthLost={onAuthLost} /> : null}
        {tab === "channels" ? <Channels onAuthLost={onAuthLost} /> : null}
        {tab === "affiliates" ? <Affiliates onAuthLost={onAuthLost} /> : null}
      </div>
    </>
  )
}
