# Shopify parity — module specs, architecture & PR plan

Repo: `PrecisionHQ/medusajs-lollies-vintage` (Medusa 2.19, Next 15 storefront).
Stashed: `cms-to.md` (CMS), `SHOPIFY-PARITY.md` (this file).

## Architecture principles (all modules)

1. **Medusa-native modules** under `backend/src/modules/<name>/` (Mikro-ORM models + service), registered in
   `medusa-config.js`, following the `email-notifications` provider pattern. No external SaaS except
   PostHog (analytics) and later a tax provider.
2. **Links, not forks**: relate to core Product/Variant/Order/Customer via Medusa links; never patch core.
3. **Admin UI** via `src/admin/routes/<name>/` (full pages) + `src/admin/widgets/` (`defineWidgetConfig`)
   injected into product/order/customer detail — same pattern as `promotion-exclusions.tsx`.
4. **Store API** under `src/api/store/<name>/` (published/approved-only reads, authed writes), consumed from
   `storefront/src/lib/data/<name>.ts` using the established convention: reads = `sdk.client.fetch` +
   `getCacheDirectives(tag)`, writes = `sdk.store.*` + `revalidateCacheTag`.
5. **Events → subscribers → workflows**: reuse `core-flows` where possible
   (cf. `topup-correction.ts`, `order-placed.ts`). Delayed/marketing flows use the Redis workflow engine
   (already on Railway) + Medusa scheduled jobs.
6. **Email** extends the Resend module: new template → enum in `templates/index.tsx` → subscriber.
   Preview with `pnpm email:dev`.
7. **Every module ships**: migration, seed guard (never seed prod), admin UI, store API, storefront wiring,
   QA test (`test:qa` playwright), docs line in `backend/README.md`.

---

## PR1 — Reviews & ratings

**Models** `Review`: `product_id, customer_id?, name, rating 1-5, title, body, status (pending|approved|rejected),
verified (derived: customer has delivered order containing product), helpful_count, locale`.
**Admin API**: moderate (approve/reject), reply (v2). **Admin UI**: widget on product detail (avg + pending count)
+ `/admin/reviews` moderation queue. **Store API**: `GET /store/products/:id/reviews` (approved only, paginated),
`POST` (authed or guest+email-verification — DECISION, default authed-only), `POST /:id/helpful`.
**Storefront**: stars into `product-preview`, 3rd tab in `product-tabs/` (beside Product Info / Shipping),
write-a-review form, `+N reviews` anchor. Aggregate: computed on read + cached; v2 denormalize avg/count.
**Events**: `order.delivered` → email review request (ties to PR7 flows).
**Import**: Shopify review export (Judge.me/Loox CSV) → one-off script mapping to Review rows, marked unverified.

## PR2 — Wishlist

**Models** `Wishlist (customer_id unique) + WishlistItem (product_id, variant_id?)`.
No guest wishlist in v1 (authed only — keeps identity trivial).
**Store API** (all authed): list/add/remove/move-to-cart. **Admin**: read-only widget on customer detail
(wishlist count + items, for support). **Storefront**: heart toggle in `product-actions` + `product-info`,
`/account/wishlist` page + `AccountNav` link, wishlist count badge in header (v2).
**Events**: price-drop / back-in-stock cross-check against wishlist (feeds PR5/PR7 emails).

## PR3 — Gift cards (spike first)

**Spike (½ day)**: verify what Medusa 2.19 core exposes for gift cards; if core covers issue/redeem, this PR is
thin UX only. If not: **Models** `GiftCard (code unique, initial_value, balance, currency, recipient_email,
sender_name, message, status, expires_at?)`. **Admin API/UI**: issue (fixed/ custom amount), void, balance lookup,
transaction ledger. **Store**: redeem code at cart (`/store/carts/:id/gift-cards`, adjustment line), balance check,
email delivery via Resend template with code. **Storefront**: redeem input in cart + dedicated gift-card PDP
(buy flow = custom product). **Rules v1**: single currency per card (matches region currency), no partial-refund
to card (refund to original payment), expiry per `expires_at` or none.

## PR4 — Bundles

**Scope v1**: fixed-price bundle = new Product of type `bundle` + `BundleComponent (bundle_variant_id,
component_variant_id, qty)` + `price`. Cart workflow expands bundle line into component lines for
fulfillment/inventory (components decrement, bundle itself carries no stock). **Admin UI**: bundle composer
(pick components + qty + bundle price, margin preview vs sum of parts). **Storefront**: bundle PDP section
("What's inside", per-item thumbnails, savings callout). **Out of scope v1**: %‑off auto-bundles, mix-and-match,
subscription bundles.

## PR5 — Preorder + back-in-stock (one PR, shared availability hooks)

**Preorder**: variant flags `allow_preorder, preorder_available_at, preorder_eta_text` + `CAPTURE` strategy:
Stripe authorize-now/capture-on-fulfillment (manual capture). Storefront: ETA + preorder badge replace delivery
estimate; checkout copy discloses charge timing; account order shows preorder status. Cancellation = release
authorization via workflow.
**Back-in-stock**: `StockSubscription (variant_id, email/customer_id, notified_at, token)`.
Subscriber on `inventory.level_updated` (restock to >0) → batch Resend "back in stock" with product link →
mark notified. Storefront: "Notify me" replaces Add-to-cart when OOS; account page lists subscriptions;
unsubscribe via token link. Wishlist cross-check: notify wishlist owners too.

## PR6 — Loyalty (earn & burn, no tiers in v1)

**Models** `LoyaltyAccount (customer_id, balance) + LoyaltyLedger (customer_id, delta, reason, order_id?)`.
**Rules v1**: earn N pts per € on `order.placed` (config constant, no tiers/multipliers); burn = fixed-denomination
coupon auto-issued (e.g. 500 pts → €5 code via Promotions API) with idempotency on order id.
**Admin UI**: customer widget (balance + ledger), global rule editor (earn rate, min redemption).
**Storefront**: points balance in `/account` overview, redeem button issuing code, ledger history.
**Guardrails**: points are a liability — expiry (e.g. 12 mo inactivity), no cash value, void on refund/return
(workflow on `order.refunded` reverses earn). Tiers/vip pricing explicitly v2.

## PR7 — Lifecycle email flows (abandoned + post-purchase)

**Engine**: Medusa scheduled job (hourly) + workflows with delay steps on the Redis engine.
Flows v1: (1) **abandoned cart**: `cart.updated` active, no order in N hrs (default 4, config), email with
cart lines + recovery link (cart id in URL, storefront rehydrates); single reminder + second with incentive
only if enabled; (2) **post-purchase**: `order.placed` +7d review request (PR1), +30d winback if no repeat order;
(3) **welcome**: `customer.created` → 10% code (ties to promotions). Each flow: opt-out respected, frequency cap
(1 marketing email / 3 days / customer), idempotency keys on cart/order id.
**New Resend templates**: `cart-abandoned, review-request, winback, welcome` (+ plain-text fallbacks).
**Admin UI**: flows list with on/off + delay/incentive config + per-flow sent/open stats (basic counters first,
PostHog deep stats in PR8). **Storefront**: recovery route rehydrating cart from id.

## PR8 — Analytics (PostHog)

**Client**: PostHog snippet in storefront layout; events `product_viewed, collection_viewed, search_performed,
cart_updated, checkout_started, order_placed` (server-side mirror on `order.placed` for reliability).
**Backend**: subscriber emitting server events with region/currency/cart value.
**Admin**: dashboard route with 6 KPI cards (revenue, orders, AOV, conversion, top products, search no-result rate)
backed by PostHog API (embed) — Medusa admin stays operational; analysis lives in PostHog.
**Privacy**: cookie consent banner (EU store — required), anonymized IPs, DPA with PostHog EU hosting.
**Out of scope**: custom warehouse/BI; export CSV from PostHog suffices for v1.

## PR9 — Markets pricing UX + regions/currencies + shipping + tax decision

**Core constraint (Medusa ≠ Shopify Markets)**: a Medusa Region holds exactly ONE `currency_code`.
Shopify shows 130+ presentment currencies on one market; here every currency = a separate Region row
(region + tax region + shipping options + price list + Stripe payout account). Expansion is therefore
phased, not flipped on. See Appendix A for Shopify's full coverage and Appendix B for the rollout.

**Phase 0 — fix (do with PR7, before spending on flows)**: split the UK out of the seed's EUR "Europe" region.
Today `seed.ts` charges Brits in EUR (`countries: [gb, de, dk, se, fr, es, it]`, currencies `eur`+`usd`) —
Shopify would default them to GBP and conversion drops ~materially. Result: `EU` region
(de, fr, es, it + nl, be, ie, at, pt, fi as added) on EUR; `UK` region (gb) on GBP, with GBP prices,
GBP shipping bands, UK tax region, GBP Stripe payout account.
**Phase 1**: Nordics split (DK→DKK, SE→SEK, add NO→NOK) + CH→CHF. **Phase 2** (on demand): US→USD, CA→CAD,
AU→AUD, JP→JPY, SG→SGD, AE→AED. Each phase = migration script (idempotent, `medusa exec`), never seed edits.

**Pricing UX**: admin matrix editor (product × region: price, compare-at, currency) writing to Price Lists API;
bulk CSV price import/export; rounding rules per currency (0-decimal: JPY, KRW, etc. — no `.99` endings);
storefront already region-aware (`getRegion`) — no storefront work except a country→region redirect map.
**Shipping**: table-rate rules (weight/subtotal bands per service zone) via fulfillment option rules; admin UI
for bands; replaces flat Standard/Express-only setup. New regions get zones at creation. Carrier rates
(DHL/GLS) explicitly later. **Duties**: display-only estimator at checkout for non-EU (v2).
**Tax**: stay on manual `tp_system` regions until thresholds force a provider. Revisit triggers: EU OSS
€10k cross-border, UK revenue £50k (reassess import VAT handling), any US state nexus ($100k / 200 txns).
Provider slot (Avalara/TaxJar) specced in `medusa-config.js` now, integrated when revenue says so.

---

## Sequencing (revenue order)

1. PR9-Phase-0 UK/GBP split (stop charging Brits in EUR) + PR7 flows (cart recovery) + PR1 reviews
   (request emails ride PR7). Instrument PR8 events in the same pass.
2. PR5 back-in-stock (captures lost demand) + PR2 wishlist (cheap, feeds notifications).
3. PR4 bundles + PR5 preorder (AOV + cash flow; needs Stripe manual-capture verified).
4. PR9-Phase-1 Nordics/CH regions + pricing matrix + table-rate shipping (margin control as catalog grows).
5. PR6 loyalty (only after PR8 repeat-purchase data says it pays).
6. PR3 gift cards (spike now to verify core; build pre-Q4 unless gifting is core — confirm).
7. PR8 dashboards, PR9-Phase-2 regions on demand (US/CA/AU/JP when traffic justifies).

## Cross-cutting TODOs

- [ ] Consent banner + privacy policy update (blocks PR8).
- [ ] Stripe manual-capture mode verified on test keys (blocks PR5 preorder).
- [ ] Stripe payout accounts per settlement currency: EUR + GBP at Phase 0, +DKK/SEK/NOK/CHF at Phase 1
      (else FX bleeds margin on every payout).
- [ ] Price backfill per new region + 0-decimal rounding audit (JPY/KRW-style currencies never show decimals).
- [ ] Resend sender reputation: dedicated domain + SPF/DKIM before any marketing flow (blocks PR7).
- [ ] Playwright QA coverage per PR (`test:qa`), seed fixtures extended, never run seed on prod.
- [ ] Redirects table for Shopify URL migration (SEO day-one, pairs with CMS work in `cms-to.md`).
- [ ] Threshold watch: EU OSS €10k, UK £50k, US state nexus — calendar reminder quarterly (blocks tax surprise).

---

## Appendix A — what Shopify supports (benchmark, Sept 2026)

Source: Shopify Help Center (Shopify Payments countries, Markets currencies, payout currencies).

**Shopify Payments countries (40)** — where a merchant can be based and take payments natively
(powered by Stripe; outside these, third-party gateway + 2% fee):
Australia, Austria, Belgium, Bulgaria, Canada, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland,
France, Germany, Gibraltar, Greece, Hong Kong SAR, Hungary, Ireland, Italy, Japan, Latvia, Liechtenstein,
Lithuania, Luxembourg, Malta, Mexico, Netherlands, New Zealand, Norway, Poland, Portugal, Romania,
Singapore, Slovenia, Spain, Sweden, Switzerland, UAE, UK, US.

**Presentment currencies (~130)** — what shoppers can browse/pay in on one Shopify store via Markets
(auto-converted from base currency, 1.5–2% conversion fee baked in or on payout):
AED, AFN, ALL, AMD, ANG, AOA, ARS, AUD, AWG, AZN, BAM, BBD, BDT, BIF, BMD, BND, BOB, BRL, BSD, BWP,
BZD, CAD, CDF, CHF, CLP, CNY, COP, CRC, CVE, CZK, DJF, DKK, DOP, DZD, EGP, ETB, EUR, FJD, FKP, GBP,
GEL, GIP, GMD, GNF, GTQ, GYD, HKD, HNL, HTG, HUF, IDR, ILS, INR, ISK, JMD, JPY, KES, KGS, KHR, KMF,
KRW, KYD, KZT, LAK, LBP, LKR, LRD, LSL, MAD, MDL, MKD, MMK, MNT, MOP, MUR, MVR, MWK, MXN, MYR, MZN,
NAD, NGN, NIO, NOK, NPR, NZD, PAB, PEN, PGK, PHP, PKR, PLN, PYG, QAR, RON, RSD, RUB, RWF, SAR, SBD,
SCR, SEK, SGD, SHP, SLL, SRD, STD, SZL, THB, TJS, TOP, TRY, TTD, TWD, TZS, UAH, UGX, USD, UYU, UZS,
VND, VUV, WST, XAF, XCD, XOF, XPF, YER, ZAR, ZMW.
(Some restricted by merchant location, e.g. France; payouts support a smaller subset per region —
Advanced/Plus for multi-currency payouts.)

**What this means for us**: Stripe (our processor) clears 135+ of these, so the gateway is NOT the gap.
Parity = regions + price lists + tax/shipping zones + payout accounts per currency (PR9 phases above).
We deliberately do NOT chase 130 currencies — we chase the 4–8 that hold our revenue.

---

## Appendix B — grill decisions (locked defaults)

| # | Question | Decision |
|---|----------|----------|
| 1 | Reviews: who can post? Photos? Old reviews? | Authed + verified-purchase only in v1; guests cut (spam). No photos v1. Import all Shopify reviews as approved/`verified=false` (volume + honesty beats cherry-picking). |
| 2 | Wishlist: guests? Sharing? | Account-holders only v1. No shareable links (v2). |
| 3 | Gift cards: do you sell them? | **CONFIRM WITH MERCHANT.** Default: spike core support now, build pre-Q4. Digital only, single currency per card (matches Shopify: issued in store default currency, converted at checkout). |
| 4 | Bundles: what mechanics? Margin? | Fixed-price sets v1. Bundle price locked at creation; admin alert if component sum drops below it during sales. Inventory decrements components. |
| 5 | Preorder: charge now or at ship? | Authorize-now / capture-on-fulfillment (Stripe manual capture). ETA is a required field. Cancellation releases the auth via workflow. |
| 6 | Back-in-stock: instant or batch? | Hourly batch, fire only when stock ≥ 5 (avoids one-return ping-pong). One email per subscription, then auto-resolve. |
| 7 | Loyalty: rates, liability? | Deferred until PR8 proves repeat. If built: 1 pt/€, 500 pts = €5 code, 12-mo inactivity expiry, earn reversed on refund. Points = balance-sheet liability, finance signs off. |
| 8 | Flows: copy owner? Discounts? Caps? | Merchant owns copy (we ship templates). Cart reminder #1 no discount (4h), #2 with 10% only if toggled on (24h). Welcome 10%. Cap 1 marketing mail / 3 days. |
| 9 | Analytics: which 5 metrics? | Revenue, conversion rate, AOV, top-10 sell-through, search no-result rate. Restock rule: sell-through velocity + days-of-cover. |
| 10 | Markets: which countries first? Tax? Shipping? | EU (EUR) + UK (GBP) now; Nordics + CH next; US+ when traffic justifies. Manual tax until Appendix triggers. Table rates now, carriers later. |

Only #3 needs your answer; the rest proceed as specced unless you object.
