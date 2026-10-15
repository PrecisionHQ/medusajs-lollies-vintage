"use client"

import { LAB_IDS, LOCKED, TAB_LABELS, type TabId } from "@modules/app/features"

/**
 * Features screen — every capability, toggleable. Curated tabs run the
 * triage workflow; Labs tabs are full admin parity kept out of the way
 * until enabled here (or auto-enabled by an attention jump).
 */
export default function FeaturesScreen({
  enabled,
  onChange,
  onBack,
}: {
  enabled: TabId[]
  onChange: (tabs: TabId[]) => void
  onBack: () => void
}) {
  const toggle = (id: TabId) => {
    if (LOCKED.includes(id)) return
    onChange(
      enabled.includes(id) ? enabled.filter((t) => t !== id) : [...enabled, id]
    )
  }

  const labsOn = enabled.filter((t) => LAB_IDS.includes(t)).length

  return (
    <div className="la-wrap">
      <div className="la-row">
        <h1 className="la-h1">Features</h1>
        <button className="la-btn-ghost" onClick={onBack}>Done</button>
      </div>
      <div className="la-card">
        <h2 className="la-h2">Triage (default)</h2>
        <p className="la-muted">
          Attention-first: approvals, orders, money, catalog. Turn off what
          you never touch — except Status, which is home.
        </p>
        {(Object.keys(TAB_LABELS) as TabId[])
          .filter((t) => !LAB_IDS.includes(t))
          .map((t) => (
            <div key={t} className="la-row la-item">
              <span>{TAB_LABELS[t]}</span>
              <button
                className="la-btn-ghost"
                aria-pressed={enabled.includes(t)}
                disabled={LOCKED.includes(t)}
                style={
                  enabled.includes(t)
                    ? { borderColor: "#c8a24a", color: "#f3e9d2" }
                    : undefined
                }
                onClick={() => toggle(t)}
              >
                {enabled.includes(t) ? "On" : "Off"}
              </button>
            </div>
          ))}
      </div>
      <div className="la-card">
        <h2 className="la-h2">Labs ({labsOn} on)</h2>
        <p className="la-muted">
          Full admin parity, hidden until needed. Anything here that starts
          needing attention will surface itself via the Status card.
        </p>
        {LAB_IDS.map((t) => (
          <div key={t} className="la-row la-item">
            <span>{TAB_LABELS[t]}</span>
            <button
              className="la-btn-ghost"
              aria-pressed={enabled.includes(t)}
              style={
                enabled.includes(t)
                  ? { borderColor: "#c8a24a", color: "#f3e9d2" }
                  : undefined
              }
              onClick={() => toggle(t)}
            >
              {enabled.includes(t) ? "On" : "Off"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
