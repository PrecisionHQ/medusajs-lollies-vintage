# Bundle module (PR-08)

Bundles are **buy-get promotions**, not fake SKUs: a named set of variants
with an automatic discount when the whole set is in the cart. The discount
lives on the Promotion (type `buyget`, automatic); this module stores the
composition (`Bundle` + `BundleComponent`) so the composer, health check and
storefront can render it.

Why not a fixed-price bundle SKU with cart expansion: expanding lines in
`cart.updated` fights platform pricing (per-line tax, adjustments, and this
repo's top-up correction all key off real lines). A money bug at checkout is
the worst kind of bug; buy-get gives the same shopper outcome with native
semantics (components decrement naturally, discount shows as a promo line).

## First-time setup (needs a live DB)

```bash
npx medusa db:generate --modules bundle
npx medusa db:migrate
```

## Files

- Admin API: `src/api/admin/bundles/route.ts` (GET list with margin health,
  POST create), `.../[id]/route.ts` (POST rename/toggle, DELETE).
  Definition changes (components, discount) delete + recreate the promotion —
  rule surgery is not worth the risk.
- Store API: `src/api/store/bundles/route.ts` (GET `?product_id=` active
  bundles with enriched components).
- Admin UI: `src/admin/routes/bundles/page.tsx` (composer + health).
- Storefront: `BundleSection` on the PDP ("Complete the set" + add-all).
