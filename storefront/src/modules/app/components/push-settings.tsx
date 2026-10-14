"use client"

import { useEffect, useState } from "react"
import { appFetch, backendUrl, getToken } from "@modules/app/backend"

type Device = "phone" | "desktop"

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/**
 * Alerts — push subscription for this device.
 *
 * Desktop toggle: the same login on a laptop subscribes with
 * device=desktop, so the admin send route can target either or both.
 * Binding ties the endpoint to this admin login, which is what unlocks
 * the question/review pings (unbound rows only get manual broadcasts).
 */
export default function PushSettings() {
  const [support, setSupport] = useState<"yes" | "no" | "checking">("checking")
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [device, setDevice] = useState<Device>("phone")
  const [bound, setBound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    setSupport(ok ? "yes" : "no")
    if (ok) {
      setPermission(Notification.permission)
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(!!sub))
        .catch(() => {})
    }
  }, [])

  const subscribe = async (nextDevice: Device) => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      if (Notification.permission === "denied") {
        throw new Error("Notifications are blocked for this site — allow them in the browser settings first.")
      }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        const { publicKey } = await fetch(
          `${backendUrl()}/store/push/vapid-key`,
          { headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "" } }
        ).then((r) => {
          if (!r.ok) throw new Error("Push is not configured on the backend yet (VAPID keys missing).")
          return r.json()
        })
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }
      const json = sub.toJSON()
      await fetch(`${backendUrl()}/store/push/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: json.keys,
          device: nextDevice,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Could not save the subscription.")
      })
      // Bind to this admin login (needs the admin JWT, hence appFetch).
      if (getToken()) {
        await appFetch("/admin/push/bind", {
          method: "POST",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        setBound(true)
      }
      setDevice(nextDevice)
      setSubscribed(true)
      setPermission(Notification.permission)
      setNote(
        nextDevice === "desktop"
          ? "This computer will get shop alerts."
          : "This phone will get shop alerts."
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscription failed.")
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await fetch(`${backendUrl()}/store/push/subscriptions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
      }
      setSubscribed(false)
      setBound(false)
      setNote("Alerts off on this device.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unsubscribe.")
    } finally {
      setBusy(false)
    }
  }

  if (support === "checking") return null
  if (support === "no") {
    return (
      <div className="la-card">
        <h2 className="la-h2">Alerts</h2>
        <p className="la-muted">This browser cannot do push notifications — install the app in Chrome/Safari to get alerts.</p>
      </div>
    )
  }

  return (
    <div className="la-card">
      <h2 className="la-h2">Alerts</h2>
      {permission === "denied" ? (
        <p className="la-err">Notifications are blocked — allow them in the browser site settings, then come back.</p>
      ) : null}
      <div className="la-row" style={{ marginBottom: 8 }}>
        <p className="la-muted" style={{ margin: 0 }}>This device is a…</p>
        <div style={{ display: "flex", gap: 8 }}>
          {(["phone", "desktop"] as Device[]).map((d) => (
            <button
              key={d}
              className="la-btn-ghost"
              aria-pressed={device === d}
              disabled={busy}
              style={device === d ? { borderColor: "#c8a24a", color: "#f3e9d2" } : undefined}
              onClick={() => (subscribed ? subscribe(d) : setDevice(d))}
            >
              {d === "phone" ? "Phone" : "Desktop"}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="la-err">{error}</p> : null}
      {note ? <p className="la-muted">{note}</p> : null}
      {!subscribed ? (
        <button className="la-btn" disabled={busy} onClick={() => subscribe(device)} style={{ width: "100%" }}>
          {busy ? "Setting up…" : "Turn on shop alerts"}
        </button>
      ) : (
        <>
          <p className="la-muted">
            On · {device}{bound ? " · linked to your login" : " · not linked (sign out/in to link)"}.
          </p>
          <button className="la-btn-ghost" disabled={busy} onClick={unsubscribe} style={{ width: "100%" }}>
            Turn alerts off
          </button>
        </>
      )}
      <p className="la-muted" style={{ fontSize: 12 }}>
        Linked devices get question, review and stock pings. Test delivery from the dashboard: POST /admin/push/send.
      </p>
    </div>
  )
}
