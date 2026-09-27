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

## Not ours (left untouched)

Open PRs #5–#12, #15, #17 and branches `docs/program-planning`, `pr-01…pr-09`
belong to other workstreams (regions, flows, reviews, analytics, stock,
wishlist, bundles, preorder, docs). Merged nothing outside the list above.

## Pre-existing history

Everything before `7f6940a` (initial commits, Railway scaffolding, seeding,
2.x upgrades, storefront work) predates this engagement — see `git log`
for the full trail.
