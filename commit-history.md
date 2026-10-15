# Commit history — Lollies Vintage (this engagement)

Repo: `PrecisionHQ/medusajs-lollies-vintage`, branch `master`.
Fork point for the work below: `7f6940a Merge branch 'staging'`.
Everything listed here was built, deployed to Railway, and verified live
before its PR. Deploys use `railway up` uploads, so git history trails
production by design, never leads it.

## Our commits (newest last)

| Date | Commit | Message |
|------|--------|---------|
| 2026-09-24 | `2ec9e88` | feat(admin): per-promotion product exclusion editor |
| 2026-09-24 | `b3128c7` | Merge pull request #1 (exclusion editor) |
| 2026-09-25 | `c9c79bd` | feat(promotions): universal top-up floor with per-coupon delta display |
| 2026-09-25 | `57f1f18` | Merge pull request #2 (top-up floor) |
| 2026-09-25 | `9e0d51e` | fix(backend): run migrations on every boot, not just first seed |
| 2026-09-27 | `a6fb5b2` | Merge pull request #3 (migrate-on-boot) |
| 2026-09-27 | `66579fc` | feat(gift-cards): official loyalty plugin + minimal storefront wiring |
| 2026-09-27 | `8534a35` | Merge pull request #4 (gift cards) |
| 2026-09-27 | `0a24ff1` | feat(payments): Polar redirect-checkout provider |
| 2026-09-27 | `8738a5f` | Merge pull request #13 (Polar) |
| 2026-09-27 | `ce8d74a` | feat(search): index variant options for color/size search and filtering |
| 2026-09-27 | `1b3ff3a` | feat(payments): Dodo redirect-checkout provider (original, on stacked branch) |
| 2026-09-27 | `c544955` | feat(payments): Dodo redirect-checkout provider (rebased onto master) |
| 2026-09-27 | `e7f94a2` | Merge pull request #18 (Dodo; replaces auto-closed #14) |
| 2026-09-27 | `ee8c5ff` | Merge pull request #16 (search facets) |

## Pull requests

| PR | Title | State | Notes |
|----|-------|-------|-------|
| #1 | feat(admin): per-promotion product exclusion editor | MERGED | Widget at `promotion.details.side` + admin API route (`ne` rules; `nin` doesn't exist in 2.19) |
| #2 | feat(promotions): universal top-up floor with per-coupon delta display | MERGED | Subscriber correction + sync route override + delta rows; live matrix green |
| #3 | fix(backend): run migrations on every boot, not just first seed | MERGED | Unblocked `search_index` (and all future modules) |
| #4 | feat(gift-cards): official loyalty plugin + minimal storefront wiring | MERGED | `@medusajs/loyalty-plugin@2.19.0`; isolated UI for template swap |
| #13 | feat(payments): Polar redirect-checkout provider | MERGED | + shared redirect-payments infra; stubbed keys |
| #14 | feat(payments): Dodo redirect-checkout provider | CLOSED (unmerged) | Auto-closed when #13's branch merge deleted its base; replaced by #18 |
| #16 | feat(search): index variant options for color/size search and filtering | MERGED | `variants.options.value` searchable + filterable; live matrix green |
| #18 | feat(payments): Dodo redirect-checkout provider | MERGED | Rebased onto master after #13; PWYW-amount field pending live-key proof |
| #99 | feat(push): Web Push subscriptions, send API + moderation pings | MERGED | `push` module + store/admin routes, question/review admin-only pings, 404/410 self-hygiene; 9 tests |
| #100 | feat(pwa): hidden owner app shell with admin login + status board | MERGED | `/app` route, manifest/icons/SW (scope `/app`), middleware exemption, robots/noindex |
| #101 | feat(pwa): moderation + alerts tabs, owner-app docs | MERGED | Rebasing onto master (add/add on app-shell, kept full version) |
| #102 | feat(push): new-order admin ping on order.placed | MERGED (into base) | Stacked on #99; landed onto master via re-land #111 |
| #103 | feat(pwa): Orders tab — list, fulfill, tracking, capture, cancel | MERGED | Cherry-picked onto master; fail-open filters, js-sdk-typed bodies |
| #104 | feat(pwa): refunds in order detail + discount Codes tab | MERGED | Draft orders skipped (unused in codebase) |
| #105 | feat(pwa): Catalog tab — search, price, stock, publish, scan | MERGED | Exact-then-`q` variant search, absolute-set stock adjust |
| #106 | feat(pwa): Clients + Returns tabs | MERGED | Receive-all chains initiate+confirm; partial receive deferred |
| #107 | feat(push): daily nudge for flows paused 30+ days | MERGED (into base) | Windowed `updated_at`, no storage; landed onto master via re-land #111 |
| #108 | feat(pwa): Flows tab — automation switches, campaigns, send-now | MERGED | Two-tap send-now; composing stays dashboard-side |
| #109 | feat(phone): summary +30d revenue series, top products, SLA list | MERGED | Additive fields; self-contained try/catch; 2 tests |
| #110 | feat(pwa): Board+ chart, top products, SLA card | MERGED | CSS bars, Open-to-order jump; parity list complete |
| #111 | feat(push): land order ping + flow nudge (from #102, #107) | MERGED | Re-land vehicle: stacked PRs merge into their base, not master |
| #112 | feat(pwa): land moderation + alerts tabs (from #101) | MERGED | Same re-land pattern |
| #113 | docs: log phone-parity PRs #99-#112 in commit history | MERGED | Logbook |
| #114 | docs: mark PWA deploy done (Railway, 2026-10-15) | MERGED | VAPID live, /app 200s, CORS preflight verified |
| #115 | fix(marketing): review-request delivered query via fulfillments | MERGED | Hotfix: hourly prod failure on non-existent Order.fulfillment_status; delivered-first + shipped fallback, 4 tests |
| #116 | feat(ops): heartbeat module + attention aggregator | MERGED | `ops` module (7 jobs wired) + `GET /admin/ops/attention` (8 sections, fail-open, bounded); 3 tests |
| #117 | feat(admin): Attention hub dashboard page | MERGED | Sidebar route, severity cards, fix links, all-clear state |
| #118 | feat(ops): digest job + PWA attention card | MERGED | Shared builder extraction, 08:00 digest (silent on clear days), Status-tab card; 3 tests |

## Not ours (left untouched)

Open PRs #5–#12, #15, #17 and branches `docs/program-planning`, `pr-01…pr-09`
belong to other workstreams (regions, flows, reviews, analytics, stock,
wishlist, bundles, preorder, docs). Merged nothing outside the list above.

## Pre-existing history

Everything before `7f6940a` (initial commits, Railway scaffolding, seeding,
2.x upgrades, storefront work) predates this engagement — see `git log`
for the full trail.
