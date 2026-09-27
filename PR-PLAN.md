# PR plan — self-contained PRs (gift cards excluded)

Each PR ships independently: migration + backend + admin UI + store API + storefront + QA + docs.
Merge order follows dependencies; anything unblocked can parallelize.

## Wave 1 — stop losing money

### PR-01 — UK/GBP region split (PR9-Phase-0)
**Scope**: idempotent `medusa exec` migration: new `UK` region (gb, GBP), GBP tax region, GBP Standard/Express
shipping options linked to EU fulfillment set, GBP price backfill for all variants, Stripe GBP payout account
checklist in docs. Seed `gb` stays (dev-only) but prod regions come from this script.
**Accept**: GB customer sees £ prices, GBP checkout, correct shipping bands; EU region unchanged.
**Test**: QA checkout in GB + DE; `test:qa` region fixture. **Depends on**: nothing.

### PR-02 — Abandoned cart flow
**Scope**: hourly scheduled job + delay workflow (cart active, no order in 4h → reminder #1, 24h → reminder #2
with 10% code only if admin-toggled); `cart-abandoned` Resend template (+text fallback); storefront
`/cart/recover/[id]` rehydration route; admin flows page with on/off + delay config + sent counter;
1 mail / 3 days cap, idempotency on cart id, opt-out respected.
**Accept**: abandoned cart gets 1–2 mails, recovery link restores cart, caps hold.
**Test**: QA abandon → mailhog/Resend test → recover. **Depends on**: Resend domain + SPF/DKIM (ops task, PR-02 blocker).

### PR-03 — Post-purchase + welcome flows
**Scope**: `review-request` (+7d post-delivery), `winback` (+30d no repeat order), `welcome` (10% code on
`customer.created`) templates + jobs; reuse PR-02 engine/caps/admin page.
**Accept**: delivered order triggers review mail; dormant customer gets winback; new signup gets code.
**Test**: QA each trigger. **Depends on**: PR-02 (engine).

### PR-04 — Reviews module
**Scope**: `Review` model (product, customer?, name, rating, title, body, pending/approved/rejected,
verified derived from delivered orders, helpful_count, locale); admin moderation queue + product-detail widget;
store API (approved list paginated, authed create, helpful vote); storefront stars on previews + 3rd product tab
+ write form; Shopify review CSV import script (approved/`verified=false`).
**Accept**: review posted → moderated → visible with stars; import script loads legacy reviews.
**Test**: QA post/moderate/render. **Depends on**: PR-03 for request mails (soft — module works standalone).

### PR-05 — Analytics instrumentation + consent
**Scope**: PostHog snippet + EU consent banner; client events
(product/collection viewed, search, cart, checkout start) + server mirror on `order.placed`
(region/currency/value); DPA + EU hosting + anonymized IPs.
**Accept**: events flow with consent gating; no tracking before consent.
**Test**: QA consent accept/reject paths. **Depends on**: nothing (do early).

## Wave 2 — capture demand

### PR-06 — Back-in-stock
**Scope**: `StockSubscription` (variant, email/customer, notified_at, token); subscriber on inventory restock
(fire at ≥5 units, hourly batch); Resend template; "Notify me" replaces Add-to-cart when OOS; account
subscriptions list; token unsubscribe; wishlist cross-check notify.
**Accept**: OOS signup → restock → one mail → link buys → subscription resolves.
**Test**: QA subscribe/restock/unsubscribe. **Depends on**: nothing (uses PR-05 account patterns).

### PR-07 — Wishlist
**Scope**: `Wishlist + WishlistItem` (customer-unique, authed only); store API list/add/remove/move-to-cart;
customer-detail widget (read-only, for support); heart toggle on product actions/info; `/account/wishlist`
page + nav link.
**Accept**: add/remove/move-to-cart round-trips; visible in account.
**Test**: QA full journey. **Depends on**: nothing.

### PR-08 — Bundles (buy-get promotions, NOT fixed-price SKU)
**Scope**: bundle = automatic buyget promotion (native in 2.19) + Bundle/BundleComponent rows for composition;
admin composer with live margin health (flags when component sales eat the saving); PDP "Complete the set"
rail with add-all. Definition changes go delete + recreate. Fixed-price SKU + cart expansion was rejected:
expanding lines in cart.updated fights per-line tax, adjustments and the top-up correction.
**Accept**: full set in cart → discount auto-applies; margin warning fires on conflicting sale.
**Test**: QA buy + inventory check. **Depends on**: nothing.

### PR-09 — Preorder
**Scope**: variant flags (`allow_preorder, preorder_available_at, preorder_eta_text` required); Stripe
authorize-now/capture-on-fulfillment (manual capture verified on test keys first); ETA badge + checkout
disclosure copy; account preorder status; cancellation releases auth via workflow.
**Accept**: preorder authorized not charged; capture on fulfill; cancel releases.
**Test**: QA buy/cancel on Stripe test. **Depends on**: Stripe manual-capture verification (ops task).

## Wave 3 — scale margins

### PR-10 — Phase-1 regions (DKK/SEK/NOK/CHF)
**Scope**: same migration-script pattern as PR-01 for DK, SE, NO (new), CH; prices, shipping bands, tax regions,
payout accounts; country→region redirect map on storefront.
**Accept**: each country shops in local currency end-to-end.
**Test**: QA checkout per region. **Depends on**: PR-01 (pattern).

### PR-11 — Pricing matrix + bulk prices
**Scope**: admin product×region price/compare-at matrix editor writing Price Lists API; CSV price import/export;
0-decimal rounding audit (JPY-style safety for future currencies).
**Accept**: edit matrix → storefront prices update per region; CSV round-trips.
**Test**: QA edit + import. **Depends on**: PR-01 (≥2 regions to be useful).

### PR-12 — Table-rate shipping
**Scope**: weight/subtotal bands per service zone via fulfillment option rules; admin bands UI; replaces
flat-only setup; new regions get zones at creation.
**Accept**: heavy/light carts price correctly per zone.
**Test**: QA band edges. **Depends on**: PR-10 (zones per region).

### PR-13 — Loyalty (GATED: build only if PR-05/PR-14 data shows repeat)
**Scope**: `LoyaltyAccount + LoyaltyLedger`; earn 1pt/€ on `order.placed` (idempotent); burn 500pts→€5 code;
customer widget + rule editor; account balance/ledger/redeem; 12-mo expiry; earn reversed on refund.
**Accept**: order earns, redeem issues code, refund reverses, expiry runs.
**Test**: QA earn/burn/refund/expiry. **Depends on**: analytics gate + PR-02 engine patterns.

### PR-14 — Analytics dashboards
**Scope**: admin KPI route (revenue, conversion, AOV, top-10 sell-through, search no-result rate) on PostHog API;
restock rule doc (velocity + days-of-cover).
**Accept**: 5 KPIs live, restock decision traceable.
**Test**: QA against known orders. **Depends on**: PR-05 (events).

### PR-15 — Redirects + SEO table (pairs with `cms-to.md`)
**Scope**: `Redirect (from_path unique → to_path, status 301/302)` model; edge/middleware lookup on storefront;
admin CRUD + Shopify URL CSV import; 404 log → suggested redirects report.
**Accept**: old Shopify URLs 301 correctly; 404 report populates.
**Test**: QA import + hit Sands. **Depends on**: nothing (do before migration cutover).

## Ops tasks (not PRs, blockers noted above)
- [ ] Resend dedicated domain + SPF/DKIM (blocks PR-02)
- [ ] Stripe manual-capture on test keys (blocks PR-09)
- [ ] Stripe payout accounts per currency (PR-01, PR-10)
- [ ] Playwright QA per PR, seed fixtures, never seed prod
- [ ] Quarterly tax-threshold review (EU OSS €10k, UK £50k, US nexus)
