# Master todo — Lollies Vintage platform (updated 2026-10-12)

## ✅ Done (merged + live)
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
- [x] P11-global foundation (PR #64 merged): 195-country table, EN toggle, provider architecture, RoW script, Tier-1 es/it/nl/pt/da/sv live (9 locales)
  - [ ] Run `medusa exec ./src/scripts/expand-regions-row.ts` on staging then prod (Rest-of-World EUR region); verify /store/regions — needs prod access
  - [ ] Human review per language, Tier-1 first (MT drafts live; admin stays English)
  - [ ] Tier-2/3 dictionaries via `storefront/scripts/opus-dicts.py` (~60 locales, machine time only)
  - [ ] RTL CSS audit when ar/he/fa/ur land
- [ ] P12 — Caching leftovers (bulk-fetch paging, revalidation webhook)
- [ ] CMS page builder: OUT per decision. P10 image migration: STASHED. Phase-1 currency splits (DKK/SEK/NOK/CHF): DROPPED per 2026-10-12 decision (EUR worldwide instead).

## ⏳ Ops / verification
- [ ] Redeploy backend, confirm hourly job errors gone (migrations from #51 now merged)
- [ ] Watch Railway CPU/memory on image-optimization burst (post-#45)
- [ ] Drop orphan `newsletter_subscriber` table when convenient (superseded, harmless)
