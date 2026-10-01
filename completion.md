# Completion log — Lollies Medusa on Railway

Date: 2026-09-23 (UTC)
Worktree: `/Users/emmanuel/orca/workspaces/Lollies-Medusa/mahimahi`
Upstream repo: `https://github.com/PrecisionHQ/medusajs-lollies-vintage.git`
Local clone: `medusajs-lollies-vintage/` (branch `mahimahi`, untracked — not yet committed)

## Done

- [x] Cloned `PrecisionHQ/medusajs-lollies-vintage` (Medusa 2.19.0 + Next.js starter, fork of `rpuls/medusajs-2.0-for-railway-boilerplate`)
- [x] Created Railway project `medusajs-lollies-vintage`
  - ID: `cf2369aa-53dd-4370-879e-07484fe8d7d4`
  - Workspace: `Railway API Deployment` (note: `oiseprecision's Projects` trial expired, could not create project there)
  - Environment: `production` (`b94e1c83-9dac-48ee-9b98-94746dbdcc6b`)
  - Dashboard: `https://railway.com/project/cf2369aa-53dd-4370-879e-07484fe8d7d4`
- [x] Added `Postgres` + `Redis` (both SUCCESS, with volumes)
- [x] Created `backend` service (`5761cc39-7b94-4331-8c28-9eed4f3999e8`), deployed via `railway up` from `medusajs-lollies-vintage/backend`
  - Deployment `ca121df9` — SUCCESS
  - Migrations + link sync + seed completed, admin user created, `Server is ready on port: 8080`
  - Domain: `https://backend-production-35a6.up.railway.app`
  - Health: `/health` 200 OK, `/app` 200, `/store/products` correctly requires `x-publishable-api-key`
  - Backend env: `NODE_ENV=production`, `MEDUSA_WORKER_MODE=shared`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`, `STORE_NAME=Lollies Vintage`, `ADMIN_CORS=*`, `STORE_CORS=*`, `AUTH_CORS=*`
  - Secrets (`JWT_SECRET`, `COOKIE_SECRET`, `MEDUSA_ADMIN_PASSWORD`) are generated and stored in Railway `backend` variables — not copied here
  - Admin email: `admin@lollies-vintage.com` (password in Railway variables)
  - Publishable key (public): `pk_1ef696f378d107a48ad549bd4e7ed81764b723782e861f0d9dac8ef3ae4a01df` via `/key-exchange`

## Monorepo decision

Repo already is a monorepo: `backend/` + `storefront/` (Medusa Next.js starter, Next 15, React 19).

Recommendation: keep monorepo, add any custom Next.js ecommerce template as a folder (e.g. `storefront-custom/`), don't create a separate repo yet. Reasons:
- Single Railway project, shared env/CORS, one PR covers API + UI
- Matches current deploy (backend uploaded from `backend/` subdir)
- Separate repo only if independent versioning/team or divergent deploy lifecycle

Current choice: deploy the storefront that came with the repo (`medusajs-lollies-vintage/storefront`), keep custom template as future second folder.

## Pending

- [x] Deploy built-in `storefront/` to Railway as `storefront` service
- [x] Tighten backend CORS (`ADMIN_CORS`, `STORE_CORS`, `AUTH_CORS`) from `*` to real backend + storefront domains (redeploy in flight, verify on SUCCESS)
- [ ] Provision + wire MeiliSearch (backend `MEILISEARCH_HOST`/`MEILISEARCH_ADMIN_KEY`, storefront `NEXT_PUBLIC_SEARCH_ENDPOINT`/`NEXT_PUBLIC_SEARCH_API_KEY`, index `products`)
- [ ] Set up S3-compatible storage / Cloudflare R2 (`S3_*`, bucket exists + public-read policy, `S3_FILE_URL`, `NEXT_PUBLIC_MEDIA_HOSTNAME`)
- [ ] Integrate Stripe payments (backend `STRIPE_API_KEY` + `STRIPE_WEBHOOK_SECRET`, storefront `NEXT_PUBLIC_STRIPE_KEY`)
- [ ] Integrate Polar payments (choose/register provider, backend config, storefront checkout)
- [ ] Integrate Resend email (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`, order + invite templates)
- [ ] End-to-end verify: storefront → backend → Postgres/Redis/Search/S3/Stripe/Polar/Resend

## Useful

- Backend: `https://backend-production-35a6.up.railway.app`
- Admin: `https://backend-production-35a6.up.railway.app/app`
- Key exchange: `https://backend-production-35a6.up.railway.app/key-exchange`
- Linked dir: `medusajs-lollies-vintage/backend` → project `medusajs-lollies-vintage`, service `backend`
- Storefront source: `medusajs-lollies-vintage/storefront`

## Storefront deploy (2026-09-23)

- [x] Created `storefront` service (`453a0fa9-99ba-4460-8d0e-1701969800be`), domain `https://storefront-production-7a40.up.railway.app`
- [x] Set `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (backend domain), `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (from `/key-exchange`), `NEXT_PUBLIC_BASE_URL` (storefront domain), `NEXT_PUBLIC_STORE_NAME=Lollies Vintage`, `NEXT_PUBLIC_DEFAULT_REGION=gb`, `NEXT_PUBLIC_INDEX_NAME=products`, `NEXT_PUBLIC_FEATURE_SEARCH_DISABLED=true` (until MeiliSearch lands), `NODE_ENV=production`
- [x] Deployed via `railway up ../storefront --path-as-root --service storefront` — deployment `f3dc90c4` SUCCESS, Next 15 build ok, `next start -p 8080`
- [x] Verified: `/api/healthcheck` `{"status":"ok"}`, `/gb` 200, `/` 307 (country redirect), backend `/store/*` 200s from storefront fetches
- [x] Tightened backend CORS from `*` to `ADMIN_CORS=https://backend-production-35a6.up.railway.app`, `STORE_CORS=https://storefront-production-7a40.up.railway.app`, `AUTH_CORS=<backend>,<storefront>` — redeploy `65d8c4c1` SUCCESS, `/health` 200, storefront `/gb` 200)
- [x] Fixed admin login page (showed "register an auth provider" tip / blank login): root cause was `BACKEND_URL` in `backend/src/lib/constants.ts` falling back to `http://localhost:9000` because it reads `RAILWAY_PUBLIC_DOMAIN_VALUE`, but Railway provides `RAILWAY_PUBLIC_DOMAIN` (verified in variable list) and `BACKEND_PUBLIC_URL` was unset — so the admin JS called localhost. Fix: set `BACKEND_PUBLIC_URL=https://backend-production-35a6.up.railway.app` — redeploy `e58b8c1b` SUCCESS, login API returns token. Follow-up hardening: patch `constants.ts` to also fall back to `RAILWAY_PUBLIC_DOMAIN`.

## Promo exclusion editor (2026-09-23)

Custom admin feature: per-promotion exclusion list, managed in the promo section. Nothing hardcoded to any code or value.
- `backend/src/admin/widgets/promotion-exclusions.tsx` — widget at `promotion.details.side`: shows excluded products, product search, add/remove, save. Auth via `medusa_auth_token` Bearer + session cookie.
- `backend/src/api/admin/promotions/[id]/exclusions/route.ts` — `GET` reads the exclusion list (resolves titles); `POST { product_ids }` replaces it. Uses `addPromotionTargetRules` / `removePromotionTargetRules` (one `ne` rule per product on `items.product.id`; `nin` does not exist in 2.19 operators). Other rules/budgets/counters untouched.
- Added `@medusajs/ui@4.2.1` to backend deps (+ matching pnpm-lock edge to the existing snapshot).
- Deploy `14a645dd` SUCCESS after two TS fixes (`nin`→`ne` service methods, optional DTO fields).
- Verified live: widget string present in prod admin bundle; route GET/POST round-trip; cart test (excluded Sweatshirt got no adjustment, Shorts got TESTNE10) — then test promo deleted.
- Notes: backend dir relinked to `backend` service (`railway service link backend` — an earlier `up --service storefront` had repointed it); Railway CLI self-update broke mid-run (EACCES) and was reinstalled (now 5.60.0) — consider disabling auto-update.
- Merged to `master` as PR #1 (`b3128c7`); local `master` in sync, feature branch pruned. Railway runs the same code via `railway up` uploads (git merge changes nothing deployed).

## Site-wide top-up floor (2026-09-24/25, in progress)

Universal rule, no flags/toggles: every percentage-off-items promo tops up to its own value over existing adjustments; per-item total always equals the highest applicable floor. Stacking no longer exists shop-wide.
- `backend/src/subscribers/topup-correction.ts` — pure integer correction on `cart.updated`: deterministic lowest-first layering, rescales only engine-placed adjustments, exact-equality no-op (≤2 cycles), refreshes payment collection, structured audit log per rewrite.
- `backend/src/api/store/carts/[id]/promotions/route.ts` — thin core-route override (same path → core middlewares still apply): native workflow, then correction inline/awaited, then refetch. Settled totals in the POST response; native errors pass through byte-identical.
- Storefront `PromotionDeltas` (`modules/common/components/promotion-deltas`): per-coupon saving rows in cart/checkout/order summaries; $0 rows hidden, all-zero notice shown.
- GOTCHA (verified live): `cartModuleService.setLineItemAdjustments` REPLACES the cart's whole adjustment set — omitting an adjustment deletes it. The correction therefore always writes the complete desired set (changed + protected-unchanged). Partial-write wipes were caught by the exclusion+top-up combined test.
- Observe phase proved triggers: only `cart.updated` fires (`line-item*` events never did); subscriber latency sub-second (apparent delay was Railway log batching ~5-8s).
- Pushed as PR #2 (`feat/topup-floor`, 5 files) — sync route, correction, delta display. Live matrix green: floor exactness, order-independent books, add-after-code, removal re-expansion, exclusion interplay, error passthrough. Test promos deleted after each run.
- Merged PR #2; local `master` synced.

## MeiliSearch (2026-09-25)

- Service `meilisearch` from `getmeili/meilisearch:v1.49.0` + persistent volume (`/meili_data/meili-db`; volume root failed version inference, subdirectory works) + public domain with target port 7700 (`https://meilisearch-production-ac9e.up.railway.app`).
- Master key in Railway vars; default admin + search-only keys fetched via `/keys`.
- Backend: `MEILISEARCH_HOST=http://meilisearch.railway.internal:7700` (private) + `MEILISEARCH_ADMIN_KEY`. Storefront: `NEXT_PUBLIC_SEARCH_ENDPOINT` (public) + `NEXT_PUBLIC_SEARCH_API_KEY` (search-only); removed `NEXT_PUBLIC_FEATURE_SEARCH_DISABLED`.
- Two real fixes: (1) `seedOnce` gated `db:migrate` behind first seed so `search_index` never got created → added `migrate` script + every-boot migrate to `start` (PR #3 `feat/migrate-on-boot`); (2) products index lacked primaryKey (inference fails on id-like fields) → set `id` via API, then full reindex via `POST /admin/meilisearch/sync`.
- Verified: 4 docs indexed, search-only key returns hits, event-driven writes healthy (no warnings), storefront `/gb/search` 200 with nav link.
- Master/admin/search keys live in Railway variables + this session only — never committed.

## Gift cards via official Loyalty Plugin (2026-09-26/27)

- v2 core has no gift cards; the plugin is `@medusajs/loyalty-plugin@2.19.0` (open-sourced Apr 2026, version-matched, peers align). Installed via `pnpm add --lockfile-only` (registry flaky — took several runs), registered in `medusa-config.js`; tables landed via every-boot migrate.
- Verified live: issue (€50 TESTGC50) → redeem (€10 item → €0 via `gift-card` credit line, capped at total) → remove (total restored). No admin delete route exists — test cards expired-neutralized (`expires_at` 2020), noted since guessable codes must not stay live.
- Storefront wiring isolated for the future template swap: all new code in `storefront/src/modules/gift-cards/` (actions, `isPaidByGiftCard`, code-entry UI); existing files only got marked one-liners (cart/checkout summaries, gift-card-only payment path, credit-line predicates replacing dead v1 `cart.gift_cards` checks). UI confirmed in the production cart bundle.
- Pushed as PR #4 (`feat/gift-cards-loyalty`); PR #3 (`feat/migrate-on-boot`) still open. Open: gift-card product setup (denominations in Admin), expiry policy, code email delivery (ties into Resend).
- PR #3 and PR #4 both MERGED to `master`; local synced, branches pruned. All deployed code now matches `master` (Railway deploys were uploads of the same files).

## Polar payments (stashed 2026-09-27 — blocked on user token)

- No off-the-shelf Medusa provider exists → custom provider build. Polar is redirect-first (PayPal shape, not Stripe): `pp_polar` in `backend/src/modules/polar/` (initiate→Polar checkout URL, authorize/verify, capture/refund, `getWebhookActionAndData` at `/hooks/payment/polar_polar`), registered conditionally like Stripe; storefront redirect button modeled on PayPal flow; sandbox first.
- Load-bearing spike before building: verify Polar Checkout API supports arbitrary cart amounts vs. products-only (changes design if products-only).
- Blocked on: user provides Polar **sandbox** access token. Webhook secret comes later (endpoint URL + events TBD by build).

## Dodo Payments (researched 2026-09-27)

- Same shape as Polar: no Medusa provider (`medusa-payment-dodo` 404) → custom build; redirect checkout sessions + webhooks. Official SDK `dodopayments@2.52.0` (Apache-2.0), test_mode/live_mode, `payment.succeeded/failed/processing/cancelled` events.
- Spike: checkout sessions take `product_cart[{product_id, quantity}]`; docs mention a per-item `amount` (lowest denomination) field — needs API-reference verification before relying on it for arbitrary cart totals. Fallbacks if absent: PWYW products (wrong model — buyer sets amount) or dashboard product mirroring (sync layer).
- Needs from user: Dodo test API key + webhook key (same shape as Polar ask).

## Polar + Dodo providers (built 2026-09-27, stubbed keys — PRs #13, #14)
- No off-shelf providers exist → custom `pp_polar` (`backend/src/modules/polar/`) + `pp_dodo` (`backend/src/modules/dodo/`), both redirect-checkout + webhook completion, registered conditionally (keys present) like Stripe. SDKs: `@polar-sh/sdk@0.49.0`, `dodopayments@2.52.0`, `standardwebhooks@1.1.1`.
- Polar: ad-hoc fixed prices per session (one generic product, no catalog sync — spike closed). Dodo: PWYW product + explicit amount (docs-hinted, LIVE-KEY VERIFICATION PENDING, mirroring fallback documented in code).
- Shared storefront infra (`modules/redirect-payments/`: redirect button + return page completing the order; `isPolar`/`isDodo` checks). Webhooks at Medusa built-ins `/hooks/payment/polar_polar`, `/hooks/payment/dodo_dodo`. Refunds: Dodo attempts via stored payment id, Polar via dashboard (documented).
- Hard-won loader facts: provider dirs need `index.ts` exporting `{ services: [...] }` (bare class crashes with "moduleProviderServices is not iterable"); `PaymentActions.SUCCESSFUL` (not CAPTURED); Polar TS SDK is camelCase outbound-snake.
- Verified: builds green; registration proven with dummy vars (both providers loaded, webhook routes answered) then dummies removed + clean redeploy (no provider traces at boot, health 200). Live checkout + webhook proof awaits real keys.
- PR #13 Polar (+ shared infra) vs master; PR #14 Dodo stacked on #13. Rebase #14 once #13 merges.

## Search facets: color, category, product, sizes (2026-09-27)

- Baseline: product/category/size text search worked; color matched only by title-convention luck (`S / Black` in variant titles), with no structured option data in the index.
- Fix (`backend/src/search/products.ts`): extended the products index with `variants.options.value` via `graph_fields` + schema (searchable + filterable), plus the missing direct `@medusajs/utils` dep. Pushed as PR #16 (`feat/search-option-facets`).
- Verified live matrix: text (sweatshirt / shirts / XL / white all hit correctly); filters (`variants.options.value = Black|S`, `categories.handle = sweatshirts`) return exact sets; storefront `/gb/search` 200.
- Note: option *titles* (Size vs Color) are not indexed, only values — enough for search + value filters; per-facet drilling (Color: Black vs Size: S) is a future enhancement. Facet checkbox UI also left out deliberately (storefront gets replaced).

## Docs (2026-09-27)

- `adr.md` (12 records) and `commit-history.md` (our commits + PR table) added
  beside this file. Outer worktree has no remote, so all three live locally.
  Other workstreams' open PRs (#5–12, #15, #17) were left untouched.

## Arbitrary-amount spike results (Polar vs Dodo)

- **Polar: SOLVED.** Ad-hoc prices: `checkouts.create({ products: [...], prices: { productId: [{ amountType: "fixed", priceAmount, priceCurrency }] } })` — arbitrary cart totals with one generic Polar product, no catalog sync. Clean fit.
- **Dodo: LIKELY but unverified.** `product_cart[].amount` field hinted in docs; confirm against API reference or test key before building; product-mirroring fallback exists.

## Storefront pnpm 11 build fix (2026-10-01, PR: storefront/build-pnpm11)
- Railway builder uses pnpm 9.15.9, which rejects `storefront/pnpm-workspace.yaml` without a `packages` field (`packages field missing or empty`) — every storefront deploy failed at `pnpm install --frozen-lockfile`.
- Fix: `"packageManager": "pnpm@11.5.1"` (builder == local version), explicit `allowBuilds` decisions (`sharp: true`, parcel/watcher + core-js `false`), `@/*` tsconfig path, lockfile refresh for Modave deps (bootstrap, swiper, photoswipe, sass, …).
- Verified: `pnpm install --frozen-lockfile` clean locally and on Railway; `next build` SUCCESS; storefront `/gb` 200 on `storefront-production-7a40.up.railway.app`.

## Shopify collection/category import scripts (2026-10-01, PR: ops/shopify-collection-scripts)
- `backend/scripts/import-shopify-collections.mjs` — builds merchandising data from Shopify lists (bridal/sale-upto-50-off via title match) + newest/random collections + name-rule garment categories; `--dry-run` default, `--apply` + `--cats` write. Handles single-collection exclusivity (sale as category) and guards deletions (refuses non-empty).
- `backend/scripts/curate-top-picks.mjs` — resolves Shopify frontpage order to Medusa IDs → `storefront/src/data/curated.ts` (+ `.json` twin for record; homepage consumes the `.ts`).
- `backend/scripts/fix-visibility-and-merch.mjs` — publishes draft new-in members, merch move-then-delete with orphan guard.
- No runtime impact: scripts are never imported by app code. Verified via `--dry-run` runs against production data (read-only).
