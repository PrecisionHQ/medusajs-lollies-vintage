# Master todo — Lollies Vintage platform (updated 2026-10-10)

## ✅ Done (merged + live)
- PRs #35–#45: Modave storefront, video lookbook/hero, purchasability, Shop All + logo, loyalty completion, backend build rescue, caching (scopes, revalidation, images)
- PR #40: Lollies footer (branding, socials, 13-method payment band, real contact)
- PR #41–#42: loyalty workstream completion + container-key deconflict
- Newsletter P1 SUPERSEDED by #50 (double opt-in, superior) — my single-step version discarded
- PR #51 (open): missing custom-module migrations + Marketing Automation admin label

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
- [x] P9 — Trimmed flows (PR #60 open): unique codes, cross-sell + price-drop jobs, welcome handoff; ADR-018. First sends need RESEND keys (scoring layered after P5+P7 volume)
- [ ] P9 — Trimmed flows (cross-sell, wishlist price-drop, unique codes, proof run, newsletter→welcome)

## 🔨 Queued — SEO + Ads (new modules)
- [x] SEO: product/collection JSON-LD, metadata templates + health report (PR #61 merged)
- [x] Ads v1: Meta + Google Merchant feeds, UTM capture, ROAS spend ledger (PR #62 open)
- [ ] Social automation: DEFERRED (needs Meta app + Page tokens)

## 🔨 Queued — structural
- [x] P11 — i18n v1 (PR #63 merged): hand-rolled zero-dep locale infra, 195-key en/fr/de dictionaries, full UI-chrome wiring (homepage, header, search, listing, cart, PDP, footer, modals); admin stays English
- [ ] P11-global — 195 countries, official language each, EN toggle (in progress, branch `feat/i18n-global`):
  - [x] Merged PR #63 to master
  - [x] `country-locale.ts` (249 ISO codes → primary official language) + `resolveLocale()` + per-locale server dictionaries + `<LocaleProvider>` (client bundle stays 103KB)
  - [x] Official↔English header toggle (`lollies-locale` cookie; routing/currency untouched) + footer language indicator follows locale
  - [x] Build-scale fix (gb-only `generateStaticParams`, rest on-demand) + searchable country selector + DeepL draft script (`storefront/scripts/deepl-dicts.mjs`)
  - [ ] NEEDS DeepL API key → run script for Tier-1 (es, it, nl, pt, da, sv) then register locales
  - [ ] Run `medusa exec ./src/scripts/expand-regions-row.ts` on staging then prod (Rest-of-World EUR region); verify /store/regions
  - [ ] Human review per language (MT draft + review; admin stays English); RTL CSS audit for ar/he/fa/ur
- [ ] P12 — Caching leftovers (bulk-fetch paging, revalidation webhook)
- [ ] CMS page builder: OUT per decision. P10 image migration: STASHED. Phase-1 currency splits (DKK/SEK/NOK/CHF): DROPPED per 2026-10-12 decision (EUR worldwide instead).

## ⏳ Ops / verification
- [ ] Merge #51, redeploy backend, confirm hourly job errors gone
- [ ] Watch Railway CPU/memory on image-optimization burst (post-#45)
- [ ] Drop orphan `newsletter_subscriber` table when convenient (superseded, harmless)
