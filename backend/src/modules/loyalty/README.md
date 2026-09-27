# Loyalty module (PR-13)

Earn & burn, no tiers (v1). Built ahead of the repeat-purchase data gate at
merchant request — watch PR-14 dashboards before marketing it.

## First-time setup (needs a live DB)

```bash
npx medusa db:generate --modules loyalty
npx medusa db:migrate
```

## Rules (defaults, finance signs off)

- Earn 1 pt per major unit of order total, on `order.placed`, idempotent per
  order. Guest orders earn nothing. Expiry stamped at earn + 12 months.
- Burn 500 pts → fixed €5 single-use code (usage-budget campaign, limit 1).
- Cancel reverses earn (`order.canceled`). Partial refunds do NOT auto-reverse
  (documented gap — adjust via a negative ledger row through the API).
- Balance reads ignore expired rows; tiers and vip pricing are v2.

## Files

- Subscribers: `order-placed-loyalty.ts` (earn), `order-canceled-loyalty.ts`
  (reverse).
- Store API: `src/api/store/loyalty/route.ts` (GET balance + ledger),
  `.../loyalty/redeem/route.ts` (POST burn → code).
- Admin API: `src/api/admin/loyalty/route.ts` (GET settings + outstanding,
  POST update rules), `.../customer/route.ts` (GET `?customer_id=` account).
- Admin UI: `src/admin/routes/loyalty/page.tsx`, customer widget.
- Storefront: `/account/loyalty` page + nav.
