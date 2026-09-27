# Wishlist module (PR-07)

One wishlist per customer (authed only — no guest wishlists in v1, per
SHOPIFY-PARITY.md Appendix B). No shareable links (v2).

## First-time setup (needs a live DB)

```bash
npx medusa db:generate --modules wishlist
npx medusa db:migrate
```

## Files

- `models/` — `Wishlist` (one per customer_id), `WishlistItem`
  (product + optional variant).
- Store API: `src/api/store/wishlist/route.ts` (GET list enriched with
  product titles/handles/thumbnails, POST add idempotent, DELETE remove).
  Move-to-cart is frontend-side (existing addToCart + remove).
- Admin: `src/admin/widgets/customer-wishlist.tsx` (read-only count + items
  on the customer detail, for support).
- Storefront: `src/lib/data/wishlist.ts`, `WishlistButton` on the PDP,
  `/account/wishlist` page + nav.
