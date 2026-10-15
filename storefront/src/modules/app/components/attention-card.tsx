"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Section = {
  key: string
  severity: "critical" | "warning" | "info"
  count: number
  items: Record<string, unknown>[]
  app_tab: string | null
  degraded?: boolean
}

type Tab = "status" | "orders" | "discounts" | "catalog" | "customers" | "returns" | "flows" | "moderate" | "alerts"

const line = (key: string, item: Record<string, unknown>): string => {
  const s = (v: unknown) => String(v ?? "?")
  switch (key) {
    case "sla":
      return `#${s(item.display_id)} · ${s(item.email)} · ${s(item.age_hours)}h`
    case "payments":
      return `#${s(item.display_id)} · ${s(item.total)} ${s(item.currency)}`
    case "jobs":
      return `${s(item.name)}: ${s(item.last_error)}`
    case "approvals":
      return `${s(item.kind)}: ${s(item.count)}`
    case "flows_off":
      return `${s(item.key)} · off ${s(item.days_off)}d`
    case "stock":
      return `${s(item.title)} · ${s(item.available)} left`
    case "campaigns":
      return `${s(item.subject)}${item.failed ? ` · ${s(item.failed)} failed` : " · stale draft"}`
    default:
      return JSON.stringify(item)
  }
}

/**
 * Attention card — top of the Status tab. Same feed as the dashboard page
 * (GET /admin/ops/attention): worst-severity dot + total, expandable rows,
 * each jumping to its fix tab. Empty feed renders nothing at all.
 */
export default function AttentionCard({
  onAuthLost,
  onGotoTab,
  onOpenOrder,
  onAdjust,
}: {
  onAuthLost: () => void
  onGotoTab: (tab: Tab) => void
  onOpenOrder: (orderId: string) => void
  onAdjust: (variantId: string) => void
}) {
  const [sections, setSections] = useState<Section[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await appFetch<{ sections: Section[] }>("/admin/ops/attention")
      setSections(res.sections ?? [])
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      // Otherwise stay silent: the board below already reports load errors.
    }
  }, [onAuthLost])

  useEffect(() => {
    load()
    const id = setInterval(load, 300_000)
    return () => clearInterval(id)
  }, [load])

  const total = sections.reduce((n, s) => n + s.count, 0)
  if (!total && !sections.some((s) => s.degraded)) return null
  const worst = sections.some((s) => s.severity === "critical" && s.count > 0)
    ? "#e07856"
    : "#c8a24a"

  const act = (s: Section, item: Record<string, unknown>) => {
    if (typeof item.order_id === "string") return onOpenOrder(item.order_id)
    if (typeof item.variant_id === "string") return onAdjust(item.variant_id)
    if (s.app_tab) return onGotoTab(s.app_tab as Tab)
  }

  return (
    <div className="la-card">
      <button
        className="la-btn-ghost"
        style={{ width: "100%", textAlign: "left", border: 0 }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: worst }}>●</span>{" "}
        {total ? `${total} need${total === 1 ? "s" : ""} you` : "Some sources unreachable"}{" "}
        <span className="la-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open
        ? sections.map((s) => (
            <div key={s.key} className="la-item">
              <p className="la-muted">
                {s.key} ({s.count}){s.degraded ? " · unreachable" : ""}
              </p>
              {s.items.slice(0, 5).map((item, i) => (
                <div key={i} className="la-row" style={{ padding: "4px 0" }}>
                  <span style={{ fontSize: 14 }}>{line(s.key, item)}</span>
                  {(item.order_id || item.variant_id || s.app_tab) && (
                    <button
                      className="la-btn-ghost"
                      style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
                      onClick={() => act(s, item)}
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        : null}
    </div>
  )
}
