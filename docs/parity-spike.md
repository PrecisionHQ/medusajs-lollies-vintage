# Parity spike (Phase 0) — 2026-10-14

Question: which Shopify-parity back-office tasks need backend wrapper routes,
vs PWA UI calling Medusa core `/admin/*` with the existing admin JWT?

Method: checked route + method exports in the installed
`@medusajs/medusa@2.19.0` dist (`backend/node_modules/.../dist/api/admin`).
Auth needs no verification beyond what the PWA already proves: every
`/admin/*` route takes the same admin JWT the login gate stores.

## Result: zero wrappers needed

| Task | Core endpoint | Methods |
|---|---|---|
| Order list / detail | `/admin/orders`, `/admin/orders/:id` | GET, GET (+POST update) |
| Fulfill (+ items, location) | `/admin/orders/:id/fulfillments` | POST |
| Tracking | `/admin/orders/:id/fulfillments/:fid/shipments` | POST |
| Cancel fulfillment / mark delivered | `.../fulfillments/:fid/cancel`, `.../mark-as-delivered` | POST |
| Cancel / complete / archive order | `/admin/orders/:id/cancel` etc. | POST |
| Capture / refund payment | `/admin/payments/:id/capture`, `.../refund` | POST |
| Refund reasons | `/admin/refund-reasons` | GET/POST |
| Inventory list / adjust | `/admin/inventory-items`, `.../:id/location-levels[/batch]` | GET/POST |
| Product edit / publish toggle | `/admin/products/:id` (`status` field) | GET/POST |
| Variant price edit | `/admin/products/:id/variants/...` | routes present |
| Promotions + codes/rules | `/admin/promotions`, `.../:id/...` (code is a field on create) | GET/POST/DELETE |
| Customers | `/admin/customers`, `/admin/customers/:id` | GET/POST/DELETE |
| Draft orders | `/admin/draft-orders` | GET/POST |
| Returns / exchanges / claims | `/admin/returns[/:id/receive|/cancel|...]`, exchanges, claims | full RMA set |
| Stock locations (fulfillment needs one) | `/admin/stock-locations` | to confirm at build time |

Field shapes (which `fields=` selections, fulfillment input `{ items, location_id }`,
refund `{ amount, reason }`) come from each route's `validators.d.ts` at build time.

## Consequence

Phases A–F are **PWA UI only** (+ push triggers in existing `push-sender`
style). No backend PRs expected unless a validator demands a field the UI
can't supply — then a thin wrapper, same pattern as `/admin/push/*`.
