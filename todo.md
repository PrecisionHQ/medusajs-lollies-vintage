# Master todo — Lollies Vintage platform (updated 2026-10-12)

## ✅ Done (merged + live)
- PR #97 merged: admin Campaigns→Email campaigns label
- Backend redeployed 2026-10-14 from master tip (#78/#79/#97 now live; phone board API verified 401-live; regions 249/249 intact)
- Branch hygiene 2026-10-14: pruned 40+ squash-merged local branches + 4 stale remote branches + duplicate docs stash; open PRs: #49 (docs) only
- PRs #35–#45: Modave storefront, video lookbook/hero, purchasability, Shop All + logo, loyalty completion, backend build rescue, caching (scopes, revalidation, images)
- PR #40: Lollies footer (branding, socials, 13-method payment band, real contact)
- PR #41–#42: loyalty workstream completion + container-key deconflict
- Newsletter P1 SUPERSEDED by #50 (double opt-in, superior) — my single-step version discarded
- PR #51 merged: missing custom-module migrations + Marketing Automation admin label
- PR #63 merged: P11 i18n v1 (fr/de UI chrome)
- PR #64 merged: P11-global foundation + Tier-1 (es/it/nl/pt/da/sv live, 9 locales, EN toggle, 195-country table, RoW script written)

## 🔨 Queued — campaigns (Resend-only, Brevo abandoned)
- [x] P1 subscriber model — DONE via #50 (`marketing_newsletter_subscription`, double opt-in)
- [x] P2 composer — DONE via #52 (drafts, preview, test-send) + #53 follow-ups
- [x] P3 sender — DONE via #53 (quarter-hourly job, send-now, send log, update-shape fixes across 16 sites)
- [x] P4 cutover — VERIFIED COMPLETE (proxy dead in all send paths; SendGrid env-absent, nothing to retire in code)

## 🔨 Queued — measurement, then smarts
- [x] P5 — PostHog live: BLOCKED on keys (none set on Railway; tracking inert by design)
- [x] P6 — pixels + CAPI (PR #54, merged; needs real IDs to fire)
- [x] P7 — interest signals (PR #56, merged); docs PR #57 open (ADR-016 + log; #55 still open)
- [x] P8 — Recommendations, rules-first (PR #58 merged; scorer + PDP related + cart drawer, event weights dormant)
- [x] P9 — Trimmed flows (PR #60 merged): unique codes, cross-sell + price-drop jobs, welcome handoff; ADR-018.
- [ ] P9 — proof run (cross-sell, wishlist price-drop, newsletter→welcome live sends; needs RESEND keys; scoring layered after P5+P7 volume)

## 🔨 Queued — SEO + Ads (new modules)
- [x] SEO: product/collection JSON-LD, metadata templates + health report (PR #61 merged)
- [x] Ads v1: Meta + Google Merchant feeds, UTM capture, ROAS spend ledger (PR #62 merged)
- [ ] Social automation: DEFERRED (needs Meta app + Page tokens)

## 🔨 Queued — structural
- [x] P11 — i18n v1 (PR #63 merged): hand-rolled zero-dep locale infra, 195-key en/fr/de dictionaries, full UI-chrome wiring (homepage, header, search, listing, cart, PDP, footer, modals); admin stays English
- [x] P11-global foundation (PR #64 merged) + Tier-1 live + RoW + deploys (2026-10-12): 195-country table, EN toggle, provider architecture, es/it/nl/pt/da/sv live (9 locales); `expand-regions-row.ts` RUN on prod (Rest-of-World EUR, 249/249 countries verified via /store/regions); backend + storefront redeployed to Railway, /fr /es /ng /jp /br verified 200
  - [ ] Human review per language, Tier-1 first (MT drafts live; admin stays English)
  - [ ] Tier-2/3 dictionaries via `storefront/scripts/opus-dicts.py` (~60 locales, machine time only)
  - [ ] RTL CSS audit when ar/he/fa/ur land
- [ ] P12 — Caching leftovers (bulk-fetch paging, revalidation webhook)
- [ ] CMS page builder: OUT per decision. P10 image migration: STASHED. Phase-1 currency splits (DKK/SEK/NOK/CHF): DROPPED per 2026-10-12 decision (EUR worldwide instead).

## 📱 Phone PWA + push (owner app at `/app`) — 2026-10-14, PRs #99/#100/#101

- [x] Backend push infra (PR #99): `push` module (`push_subscription`), store subscribe/unsubscribe/vapid-key routes, admin send/counts/bind routes, question+review admin-only pings, 404/410 self-hygiene, 9 unit tests
- [x] Hidden PWA shell (PR #100): `/app` route + admin-login gate + status board, manifest/icons/SW (scope `/app`), middleware exemption (else 307 to `/gb/app`), robots disallow, noindex
- [x] App UI (PR #101): Moderate tab (answer/close questions, approve/reject reviews), Alerts tab (subscribe, phone/desktop toggle, admin bind), `docs/owner-app.md`
- [x] Deploy (2026-10-15): `VAPID_*` generated + set on Railway, `ADMIN_CORS` extended with storefront origin (preflight verified), backend redeployed (`Migration20261014000000` ran, vapid-key serves live key, regions intact), storefront redeployed (`/app`+manifest+SW+icons 200, noindex, robots disallow, sitemap clean)
- [ ] Distribute per `docs/owner-app.md` (owner devices, install, test send)

## 📱 Shopify-mobile parity — back office in `/app` (2026-10-14)

Goal: every routine back-office task doable from the phone, matching Shopify's
mobile admin (orders → money → catalog → customers). Each phase = backend PR
(if needed) + PWA PR; most phases need PWA UI only, calling Medusa core
`/admin/*` directly with the existing admin JWT.

- [x] **0 — Spike (half day, first):** DONE 2026-10-14, see `docs/parity-spike.md` — every endpoint exists in Medusa core 2.19 (`orders`+fulfillments/shipments/cancel, `payments` capture/refund, inventory location-levels, products/variants, promotions+codes, customers, draft-orders, full RMA). **Zero backend wrappers needed:** phases A–F are PWA UI calling core `/admin/*` with the existing admin JWT.
- [x] **A — Order ops (highest value):** Orders tab (newest 50, Action/All/Unfulfilled/Unpaid, fail-open filters) + detail + one-tap fulfill/tracking/capture/cancel; **new-order push ping** via `order.placed` subscriber (PR #102 + UI PR)
- [x] **B — Money:** refund captured payments from order detail (amount + refund-reason + note); Codes tab (list, create order-level %/fixed with usage cap, pause/activate, delete). Draft orders SKIPPED — nothing in the codebase uses them (only marketing-campaign drafts); revisit if phone ordering ever becomes a thing.
- [x] **C — Catalog quick edits:** Catalog tab (name/SKU/barcode search with exact-then-`q` fallback, camera scan w/ manual fallback); per-currency price edit; stock adjust +/−/custom per location (absolute set, floor 0); publish toggle; Status stock alerts jump here via Fix button.
- [x] **D — Customers + returns:** Clients tab (search newest 100 client-side, mailto/tel links, order history + lifetime value); Returns tab (open requests fail-open, Receive-all chains initiate+confirm, Cancel). Exchanges/claims stay dashboard-side until returns prove the pattern; partial receive is a follow-up.
- [x] **E — Marketing automation (flows exist, phone UI doesn't):** Flows tab (on/off switches + sent counters + opt-outs, dashboard toggle API); campaigns (sent/failed stats, test-send, two-tap send-now); paused-30-days push nudge via daily job (PR #107 + UI PR).
- [x] **F — Board+ (only after A–E earn it):** 30d revenue chart (CSS bars, dominant currency + named others), top-5 products, >48h SLA card with Open-to-order jump (PR #109 + UI PR). Flow switches already shipped in Phase E.
- [ ] **OUT (deliberate):** POS/hardware, shipping-label purchase (no carrier account), theme/blog editor, home-screen widgets + watch (iOS doesn't grant those to PWAs), Sidekick-style AI.

## 📣 Attention hub (2026-10-15)

- [x] PR-A0 hotfix: review-request delivered query via fulfillments (hourly prod failure)
- [x] PR-A1 backend: `ops` heartbeat module (7 jobs wired) + `GET /admin/ops/attention` (8 sections, fail-open, bounded, no FX)
- [x] PR-A2 dashboard: Attention sidebar page (severity cards, fix links, all-clear state)
- [x] PR-A3 PWA + digest: Status-tab attention card (tab/order/variant jumps) + 08:00 digest ping (silent on clear days); `owner-app.md` updated

## 💰 Payments page (Phase 2, 2026-10-15)

- [x] Backend `GET /admin/payments/overview` (provider health via key presence, 30d aggregates, newest 50, stuck queue; fail-open contract, 2 tests)
- [x] PWA Money tab + provider labels on order payments
- [x] Deploy (2026-10-15): backend (`/admin/payments/overview` 401-live) + storefront (Money + Labs live, `/app` 200) redeployed; first storefront upload timed out transiently, retry succeeded, previous build served throughout (no outage)
- [ ] Dashboard Payments page (transactions table, filters, capture/refund actions) — still open
- [ ] Live proof: provider 30d totals vs provider dashboards; test-mode capture+refund round-trip (needs Stripe test keys — same errand as the auto-capture STUB-RISK)

## 🧪 Labs — full parity behind flags (2026-10-15)

- [x] Feature registry (`features.ts`: 10 curated default-ON, 9 Labs default-OFF, Status locked, per-device localStorage) + Features screen (⚙) + on-demand reveal (attention jumps auto-enable)
- [x] Labs tabs: Preorders (list + clear), Stats (KPIs 7/30/90), Spend (ledger + log + delete), Pricing (missing-price audit → Catalog Fix), Loyalty (settings + outstanding), Bundles (list + delete), Redirects (add 301 + delete), SEO (client-computed health), Shipping (zones reference)
- [x] `owner-app.md` Features section; attention-first rule documented (hidden features surface only when needing a human)

## Ops / verification

- [x] Redeploy backend, confirm hourly job errors gone → review-request root-caused (bad `fulfillment_status` filter, PR #115) and redeployed 2026-10-15; hub (PRs #116–#118) now watches all jobs via heartbeats
- [ ] Watch Railway CPU/memory on image-optimization burst (post-#45)
- [ ] Drop orphan `newsletter_subscriber` table when convenient (superseded, harmless)

## 🛒 Sales channels (Phase 3, 2026-10-15)

De-facto (Shopify): channel = synced product feed per region + per-channel
publishing toggles with error feedback + channel markets (price/currency
overrides) + orders flowing back. Missing here: registry, TikTok feed,
availability toggles, and revenue attribution (UTM stops at the cookie —
nothing reaches carts/orders today).

- [x] **C1 — Attribution plumbing (merged, awaiting deploy):** stamp `_lollies_utm` (source/campaign) into cart metadata on ensure (first-touch wins); cart→order carry-over proof rides C3's live test
- [x] **C2 — Channel registry + feeds + availability:** shared catalog-feed builder (`/feeds/google` refactored, `/feeds/tiktok` new, Google-template format); dashboard Channels page (registry CRUD on core `sales_channels` metadata, product search + batch-link availability); PWA Channels Labs tab (status, utm, feed URLs). Zero backend wrappers — core APIs throughout.
- [x] **C3 — ROAS per channel:** `GET /admin/marketing/roas` joins spend ledger → attributed order revenue (lowercased source key, unattributed bucket, null-ROAS organic, 2 tests); spend dashboard page + PWA Spend tab show per-source ROAS; deployed 2026-10-15 (backend+storefront SUCCESS, `/app`+TikTok feed 200); live proof = attributed test order + TikTok feed ingestion
- [ ] Live proof: TikTok catalog ingests feed; one attributed test order end-to-end

## 🤝 Affiliates (Phase 4, 2026-10-15)

Shopify Collabs model: open-access (any creator, auto-links) vs invite-only
(vetted, custom rates); tracking = links + personal codes; payouts automatic
(+2.9%). No app store here — build on promo codes + UTM + orders.

- [x] **F1 — Creators + codes:** `affiliate` module (`affiliate_creator`: handle unique, rate, code, status) + admin CRUD (409 on taken handle) + dashboard page (add, one-tap personal-code mint via promo API, pause/activate, delete) + PWA Affiliates Labs tab (add, mint, copy referral link); validation tests
- [x] **F2 — Attribution board:** `affiliate_hit` log (no PII, advisory) + `POST /store/affiliates/hit` beacon (always-ok, unknown handles ignored) + middleware fire on first-touch affiliate landings (fire-and-forget) + `GET /admin/affiliates/stats` (code-redemption join via line-item adjustments, owed math, per creator+currency, 2 tests) + dashboard leaderboard + PWA board
- [ ] **F3 — Payouts:** manual ledger first (mark paid + note); auto later; self-signup page only after closed program proves out

## 🧑‍💼 Staff RBAC (Phase 5, 2026-10-15)

Medusa 2.19: invites/users only, NO roles/permissions routes (verified in
dist). Full-admin-or-nothing today, including the PWA JWT. Biggest build —
last by design. Interim: owner-only posture, no shared logins.

- [ ] **R1 — Roles module:** `staff_role` (resource→actions matrix) + assignment on invite/accept
- [ ] **R2 — Enforcement:** middleware scoping `/admin/*` (UI hiding is not security) + dashboard menu gating + role-aware PWA tabs
- [ ] Roles draft: owner (all), fulfillment (orders/returns/catalog-read), support (customers/moderation/refund-cap?), marketing (flows/campaigns/codes) — amounts capped per action where it matters
