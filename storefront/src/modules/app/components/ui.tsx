"use client"

/** Shared bits for the owner app: dark phone-first theme + tiny primitives. */

import React from "react"

export const theme = {
  bg: "#17130e",
  card: "#221c14",
  ink: "#f3e9d2",
  muted: "#b9a888",
  accent: "#c8a24a",
  danger: "#e07856",
  ok: "#8fc39a",
  line: "#3a3226",
}

export function ShellStyles() {
  return (
    <style>{`
      .lollies-app { background: ${theme.bg}; color: ${theme.ink}; min-height: 100dvh; font-family: system-ui, -apple-system, sans-serif; }
      .lollies-app * { box-sizing: border-box; }
      .la-wrap { max-width: 560px; margin: 0 auto; padding: 12px 12px 48px; display: flex; flex-direction: column; gap: 12px; }
      .la-card { background: ${theme.card}; border: 1px solid ${theme.line}; border-radius: 14px; padding: 16px; }
      .la-h1 { font-size: 22px; margin: 0; }
      .la-h2 { font-size: 16px; margin: 0 0 8px; }
      .la-muted { color: ${theme.muted}; font-size: 14px; }
      .la-big { font-size: 28px; font-weight: 700; }
      .la-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .la-btn { background: ${theme.accent}; color: #17130e; border: 0; border-radius: 12px; padding: 12px 16px; font-size: 16px; font-weight: 700; min-height: 48px; cursor: pointer; }
      .la-btn:disabled { opacity: 0.5; cursor: wait; }
      .la-btn-ghost { background: transparent; color: ${theme.ink}; border: 1px solid ${theme.line}; border-radius: 12px; padding: 10px 14px; font-size: 15px; min-height: 44px; cursor: pointer; }
      .la-input, .la-textarea { width: 100%; background: #100d09; color: ${theme.ink}; border: 1px solid ${theme.line}; border-radius: 10px; padding: 12px; font-size: 16px; }
      .la-textarea { min-height: 88px; resize: vertical; }
      .la-tabs { display: flex; gap: 8px; position: sticky; top: 0; background: ${theme.bg}; padding: 8px 0; z-index: 2; overflow-x: auto; }
      .la-tab { flex: 1 0 auto; border-radius: 12px; border: 1px solid ${theme.line}; background: transparent; color: ${theme.muted}; padding: 12px 10px; font-size: 15px; font-weight: 600; min-height: 48px; cursor: pointer; white-space: nowrap; }
      .la-tab[aria-selected="true"] { background: ${theme.card}; color: ${theme.ink}; border-color: ${theme.accent}; }
      .la-err { color: ${theme.danger}; font-size: 14px; }
      .la-item { border-top: 1px solid ${theme.line}; padding: 12px 0; }
      .la-item:first-child { border-top: 0; }
      .la-actions { display: flex; gap: 8px; margin-top: 8px; }
      .la-actions .la-btn-ghost { flex: 1; }
    `}</style>
  )
}

export function money(minor: number, currency: string) {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`
}
