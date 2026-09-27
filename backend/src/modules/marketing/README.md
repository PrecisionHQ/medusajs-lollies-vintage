# Marketing module (PR-02)

Abandoned-cart flows + send log + opt-outs. Registered in `medusa-config.js`.

## First-time setup (needs a live DB — not yet run here)

```bash
npx medusa db:generate --modules marketing
npx medusa db:migrate
```

(The review module rides the same pass: `db:generate --modules marketing review`.)

Then seed the default config row once (the job also self-seeds on first run):

`medusa exec` a script or Admin → Flows → Save (saving creates the row if missing).

## Files

- `models/` — `FlowConfig` (one row per flow key), `FlowLog` (idempotency + caps),
  `MarketingOptOut` (unsubscribe list).
- `flow-guards.ts` — shared send-guards (opt-out, 3-day cap, idempotency claim).
- `utils.ts` — HMAC unsubscribe tokens + region-free email links.
- Flows: `src/workflows/abandoned-cart.ts` (PR-02), `review-request.ts`,
  `winback.ts` (PR-03); schedules: `src/jobs/abandoned-cart.ts` (hourly),
  `review-request.ts` (hourly :30), `winback.ts` (daily 08:00);
  welcome rides the `customer.created` subscriber (immediate).
- Flow keys: `abandoned_cart`, `review_request`, `winback`, `welcome`.
  Incentive codes are STATIC text — create the matching promotion in Admin.
- Review-request uses `fulfillment_status = delivered` + updated_at as the
  delivered-at proxy; per-product review deep-links land with PR-04.
- Admin: `src/api/admin/marketing/flows/route.ts` + `src/admin/routes/flows/page.tsx`.
- Unsubscribe: `src/api/store/marketing/unsubscribe/route.ts` (HMAC token, see file).

## Back-in-stock (PR-06)

- `models/stock-subscription.ts` — one row per shopper × variant, `notified_at`
  null while pending, random `token` for the emailed unsubscribe link.
- `src/subscribers/back-in-stock.ts` on `inventory-level.updated`: acts only
  when available quantity (stocked − reserved) crosses 5; resolves each
  subscription exactly once (per-row try/catch).
- Store API: `src/api/store/availability/subscriptions/route.ts`
  (POST subscribe idempotent per variant × email, GET authed list, DELETE own),
  `.../availability/unsubscribe/route.ts` (tokened delete).
- Template: `back-in-stock` (product link is region-free `/products/:handle`).
- Storefront: `NotifyMe` replaces Add to cart when OOS, account Stock alerts
  page + nav, `/unsubscribe?scope=stock` branch.

## Runtime verification (needs infra — not yet run here)

1. `docker compose up -d`, `pnpm ib`, then the two generate/migrate commands above.
2. Create a test cart with an email on the storefront, wait, and force the job:
   temporarily set schedule to every minute (revert after) or trigger the
   workflow from Admin API. Check Resend test inbox + `marketing_flow_log` rows.
3. Click recovery link → lands on `/cart` with items. Click unsubscribe →
   second run skips that email; Admin → Flows counters increment.
4. Remote-query risk: if `query.graph` rejects any cart field
   (`items.unit_price`, `total`, …), the per-cart try/catch logs and skips —
   check backend logs after the first run and trim fields if needed.
