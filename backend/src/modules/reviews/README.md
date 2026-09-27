# Reviews module (PR-04)

Product reviews: authed-only posting, moderation queue, verified-purchase flag.

## First-time setup (needs a live DB)

```bash
npx medusa db:generate --modules review
npx medusa db:migrate
```

(Can run in the same generate pass as the marketing module.)

## Files

- `models/review.ts` — the Review model.
- Store API: `src/api/store/products/[id]/reviews/route.ts` (GET approved list,
  POST authed create → pending), `.../reviews/[reviewId]/helpful/route.ts`.
- Admin API: `src/api/admin/reviews/route.ts` (GET queue), `.../[id]/route.ts`
  (POST approve/reject).
- Admin UI: `src/admin/routes/reviews/page.tsx` (moderation queue),
  `src/admin/widgets/product-reviews.tsx` (product detail: avg + pending count).
- Storefront: stars in `product-preview`, reviews tab in `product-tabs`,
  write form (authed), `src/lib/data/reviews.ts`.
- Import: `src/scripts/import-shopify-reviews.ts`
  (`medusa exec`, Judge.me/Loox CSV → approved/`verified=false`).
