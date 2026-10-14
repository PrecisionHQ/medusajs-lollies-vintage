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
- [ ] Deploy: set `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` on Railway, ensure `ADMIN_CORS` includes storefront origin, redeploy backend + storefront
- [ ] Distribute per `docs/owner-app.md` (owner devices, install, test send)

## 📱 Shopify-mobile parity — back office in `/app` (2026-10-14)

Goal: every routine back-office task doable from the phone, matching Shopify's
mobile admin (orders → money → catalog → customers). Each phase = backend PR
(if needed) + PWA PR; most phases need PWA UI only, calling Medusa core
`/admin/*` directly with the existing admin JWT.

- [x] **0 — Spike (half day, first):** DONE 2026-10-14, see `docs/parity-spike.md` — every endpoint exists in Medusa core 2.19 (`orders`+fulfillments/shipments/cancel, `payments` capture/refund, inventory location-levels, products/variants, promotions+codes, customers, draft-orders, full RMA). **Zero backend wrappers needed:** phases A–F are PWA UI calling core `/admin/*` with the existing admin JWT.
- [x] **A — Order ops (highest value):** Orders tab (newest 50, Action/All/Unfulfilled/Unpaid, fail-open filters) + detail + one-tap fulfill/tracking/capture/cancel; **new-order push ping** via `order.placed` subscriber (PR #102 + UI PR)
- [ ] **B — Money:** refunds (full/partial line + amount, reason note); discount codes (list, create %/fixed with usage limit, monitor redemptions); draft orders (create + send link — only if the shop actually takes phone orders).
- [ ] **C — Catalog quick edits:** inventory adjust (+/−, reason) from the stock-alert row; price quick-edit; publish/hide toggle; barcode path (camera scan → variant lookup → jump to its stock/price row).
- [ ] **D — Customers + returns:** customer list/search + detail (orders, lifetime value, contact link); returns/exchanges (receive, approve, restock) via Medusa RMA flow.
- [ ] **E — Marketing automation (flows exist, phone UI doesn't):** flow list with on/off switches in-app (today read-only via summary; reuse `/admin/marketing/flows` toggle API); campaign list + sent/open stats; send-now + test-send from the phone; paused-flow push nudge (e.g. winback disabled >30 days — reuse `adminOnly` ping pattern).
- [ ] **F — Board+ (only after A–E earn it):** week/month revenue chart, top products, fulfillment-SLA row (unfulfilled >48h).
- [ ] **OUT (deliberate):** POS/hardware, shipping-label purchase (no carrier account), theme/blog editor, home-screen widgets + watch (iOS doesn't grant those to PWAs), Sidekick-style AI.

## ⏳ Ops / verification
- [ ] Redeploy backend, confirm hourly job errors gone (migrations from #51 now merged)
- [ ] Watch Railway CPU/memory on image-optimization burst (post-#45)
- [ ] Drop orphan `newsletter_subscriber` table when convenient (superseded, harmless)
