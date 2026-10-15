"use client"

/**
 * Feature registry — every app capability in one list, each toggleable.
 *
 * Curated tabs default ON (the triage workflow). Labs tabs default OFF:
 * full admin parity that stays out of the way until the owner enables it
 * in Features — or until an attention row targets it, which auto-enables
 * and jumps in one tap (on-demand reveal). Status is locked: the app always
 * has a home. Persisted per device in localStorage.
 */

export type TabId =
  | "status"
  | "orders"
  | "money"
  | "discounts"
  | "catalog"
  | "customers"
  | "returns"
  | "flows"
  | "moderate"
  | "alerts"
  | "preorders"
  | "analytics"
  | "spend"
  | "pricing"
  | "loyalty"
  | "bundles"
  | "redirects"
  | "seo"
  | "shipping"
  | "channels"
  | "affiliates"

export const TAB_LABELS: Record<TabId, string> = {
  status: "Status",
  orders: "Orders",
  money: "Money",
  discounts: "Codes",
  catalog: "Catalog",
  customers: "Clients",
  returns: "Returns",
  flows: "Flows",
  moderate: "Moderate",
  alerts: "Alerts",
  preorders: "Preorders",
  analytics: "Stats",
  spend: "Spend",
  pricing: "Pricing",
  loyalty: "Loyalty",
  bundles: "Bundles",
  redirects: "Redirects",
  seo: "SEO",
  shipping: "Shipping",
  channels: "Channels",
  affiliates: "Affiliates",
}

const CURATED: TabId[] = [
  "status",
  "orders",
  "money",
  "discounts",
  "catalog",
  "customers",
  "returns",
  "flows",
  "moderate",
  "alerts",
]

const LABS: TabId[] = [
  "preorders",
  "analytics",
  "spend",
  "pricing",
  "loyalty",
  "bundles",
  "redirects",
  "seo",
  "shipping",
  "channels",
  "affiliates",
]

export const LAB_IDS = LABS
export const LOCKED: TabId[] = ["status"]

const KEY = "lollies-app-features"

export function defaultEnabled(): TabId[] {
  return [...CURATED]
}

export function loadEnabled(): TabId[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultEnabled()
    const parsed = JSON.parse(raw) as string[]
    const known = parsed.filter((t): t is TabId => t in TAB_LABELS)
    // Status always on; unknown ids dropped (forward-compat with renames).
    return [...new Set([...known, "status" as TabId])]
  } catch {
    return defaultEnabled()
  }
}

export function saveEnabled(tabs: TabId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tabs))
  } catch {
    // Private-mode Safari etc: features reset next launch. Acceptable.
  }
}
