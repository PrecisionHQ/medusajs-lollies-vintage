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

/**
 * Phase 5 (R2) — tab gating over native RBAC. Each tab names the
 * `resource:read` permission(s) it needs; null = always visible (local
 * screens with no backend read). Checked against
 * GET /admin/rbac/me/permissions (flat `resource:operation` strings,
 * wildcards expanded server-side). Fail-open: when the endpoint 404s
 * (flag off) or errors, everything shows — today's behavior preserved.
 */
export const TAB_PERMISSIONS: Record<TabId, string[] | null> = {
  status: null,
  orders: ["order:read"],
  money: ["payment:read"],
  discounts: ["promotion:read"],
  catalog: ["product:read"],
  customers: ["customer:read"],
  returns: ["return:read"],
  flows: ["marketing:read"],
  moderate: ["question:read", "review:read"],
  alerts: null,
  preorders: ["product:read"],
  analytics: ["order:read"],
  spend: ["marketing:read"],
  pricing: ["product:read"],
  loyalty: ["loyalty:read"],
  bundles: ["bundle:read"],
  redirects: ["redirect:read"],
  seo: ["product:read"],
  shipping: ["shipping:read"],
  channels: ["sales_channel:read"],
  affiliates: ["affiliate:read"],
}

export function visibleWithPermissions(tabs: TabId[], granted: Set<string> | null): TabId[] {
  if (!granted) return tabs
  return tabs.filter((t) => {
    const need = TAB_PERMISSIONS[t]
    if (!need) return true
    return need.some((p) => granted.has(p))
  })
}

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
