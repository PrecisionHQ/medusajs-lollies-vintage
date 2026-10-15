# Owner PWA (`/app`) — private shop phone app

Installable, hidden, login-gated companion to the dashboard `/phone` board.
Shipped as three PRs: backend push infra (#99) → hidden shell + login (#100)
→ moderation + alerts UI (this PR, #101).
Same data (one `GET /admin/phone/summary` fetch), plus moderation
(questions/reviews) and Web Push alerts. Lives in the storefront at the
top-level `/app` route so it is installable on the shop domain without
touching the region-prefixed store.

## URLs

- App: `<storefront>/app` (canonical, no trailing slash)
- Manifest: `<storefront>/app/manifest.webmanifest`
- Service worker: `<storefront>/app/sw.js` (scope `/app`, registered only by the app page)

## Backend env (Railway + local `.env`)

| Var | What |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` (backend dir). Missing = push inert (404 on vapid-key, `sent: 0` on sends), never a 500. |
| `VAPID_SUBJECT` | `mailto:<shop-email>` |
| `ADMIN_CORS` | Must include the storefront origin or the app's `/admin/*` calls (login verify, summary, moderation, bind, send) fail CORS. |

Push needs the `web-push` package (already in `backend/package.json`).

## Tabs

Default (triage): Status, Orders, Money, Codes, Catalog, Clients, Returns, Flows, Moderate, Alerts.

- **Status** — attention card on top (same feed as the dashboard Attention page: worst-severity dot + count, expandable rows jumping to the fix tab), then today/week orders + revenue, needs-you counts, stock alerts (60s poll, offline last-payload). Board+ (Phase F): 30-day revenue bar chart (dominant currency charted, others named), top-5 products by units, and the >48h unfulfilled list with **Open** jumping to the order.
- **Orders** (Phase A) — newest 50 with Action/All/Unfulfilled/Unpaid filters (unknown statuses fail open to Action); detail with items, totals, payments and shipments; one-tap **Fulfill** (remaining quantities), **tracking number → Ship**, **Capture** uncaptured payments, **Refund** captured payments (amount + reason + note), **Cancel** unfulfilled orders. Pure PWA UI over Medusa core `/admin/*` — no wrapper routes (see `docs/parity-spike.md`).
- **Codes** (Phase B) — discount codes: list with value/status, create order-level % or fixed codes (optional usage cap, activated on create), pause/activate, delete. Per-code redemption counts are a follow-up (core tracks budget usage on campaigns, not per-code counters).
- **Catalog** (Phase C) — find a variant by name/SKU/barcode (exact filters first, `q` fallback) or camera scan (`BarcodeDetector` where supported, manual entry otherwise); per-currency price edit (full array sent, other currencies preserved); stock adjust ±1/±5/custom against the location level (absolute set of current + delta, floor 0); publish/unpublish toggle. Stock-alert rows on Status carry a **Fix** button that jumps here with the variant preselected.
- **Clients** (Phase D) — customer search (client-side over newest 100, name/email/phone), detail with mailto/tel links, order history + lifetime value.
- **Returns** (Phase D) — open requests with items (fail-open filter, show-all toggle); **Receive all** chains initiate + confirm (executes restock per policy); **Cancel**. Partial/per-item receive is a follow-up.
- **Flows** (Phase E) — automation switches with send counters + opt-out count (same toggle API as the dashboard); campaigns with sent/failed stats, test-send to an entered email, two-tap send-now. A daily job pings admin installs when a flow has been off 30 days (once per disable event, no storage — windowed on `updated_at`).

## Features (Labs) — full parity, hidden by default

The ⚙ button opens the registry: every capability toggleable per device
(localStorage; Status locked as home). Labs tabs — Preorders (flag list +
clear), Stats (KPIs 7/30/90d), Spend (ledger + log + delete), Pricing
(missing-price audit → Catalog Fix), Loyalty (settings + outstanding),
Bundles (list + delete), Redirects (add 301 + delete), SEO (client-computed
health), Shipping (zones reference) — default OFF. Attention-first rule: a
jump targeting a disabled tab auto-enables it (on-demand reveal), so
hidden features surface exactly when they need a human and never before.
- **Moderate** — open questions (answer inline) + pending reviews (approve/reject).
- **Alerts** — push subscribe, phone/desktop toggle, admin bind.

## API surface (push)

- `GET /store/push/vapid-key` → `{ publicKey }` (404 when unconfigured)
- `POST /store/push/subscriptions` → upsert by endpoint (accepts Web Push JS shape `{ endpoint, keys: { p256dh, auth }, device }`)
- `DELETE /store/push/subscriptions` → remove by endpoint
- `POST /admin/push/bind` → bind endpoint to the logged-in admin (`user_id`)
- `GET /admin/push/subscriptions` → `{ count, by_device }` (no endpoints/keys)
- `POST /admin/push/send` → `{ title, body, url?, device? }` broadcast/test

Auto-pings: new question / new review / **new order** notify **bound (admin)
installs only** (`adminOnly`), so customer installs never see back-office
activity. The 08:00 **attention digest** (`ops-digest-daily`) reuses the hub
builder directly and pings only on days with criticals/warnings — quiet days
stay silent. Manual sends reach every install unless `device` filters. Stale endpoints (push
service 404/410) are deleted on send — no janitor.

## Distribute (owner devices only)

1. Deploy backend + storefront, set env above.
2. On the owner phone/desktop open `<storefront>/app`, sign in with an **admin**
   login (customer accounts are rejected with "owner account required").
3. Status tab: verify numbers match the dashboard `/phone` board.
4. Alerts tab: pick Phone/Desktop, "Turn on shop alerts", allow notifications.
5. Test: `POST /admin/push/send { "title": "Test", "body": "…" }` → notification arrives; tap opens the app.
6. Install: browser menu → "Add to Home Screen" / "Install".

## Hiding audit (re-run if the shell changes)

- [ ] No `<a href="/app">` anywhere outside `src/modules/app` (grep).
- [ ] `src/app/app/layout.tsx` keeps `robots: { index: false, follow: false }`.
- [ ] `src/app/robots.ts` still disallows `/app/`.
- [ ] `src/app/sitemap.ts` emits only region-prefixed URLs (no top-level routes).
- [ ] `src/middleware.ts` matcher still exempts `app` (else `/app` 307s to `/gb/app`).
- [ ] Unsigned visitors see only the sign-in form; every data call needs the admin JWT.
- [ ] SW registered only from `/app` (scope `/app`) — store pages unaffected.

## Known limits (v1)

- Admin JWT in `localStorage`: single-owner private-device assumption. On a
  shared phone use a private tab (closing it drops the token).
- No per-variant customer stock pushes — subscriptions are device-level, and
  moderation pings are admin-only by design.
- Offline: shell + last summary render; moderation actions need connectivity.
