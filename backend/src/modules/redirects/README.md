# Redirects module (PR-15)

SEO day-one for the Shopify migration: old paths 301 to new ones, 404s logged
so dead ends get fixed by pain order.

## First-time setup (needs a live DB)

```bash
npx medusa db:generate --modules redirect
npx medusa db:migrate
```

## How it works

- Paths normalize (lowercase, leading slash, no trailing slash) on write.
- Storefront middleware caches the whole table hourly (same pattern as the
  region map) and 301/302s before country routing, preserving the query string.
- `not-found.tsx` pages report misses to POST /store/redirects/404-log
  (unauthenticated, path-only, hit-counted).
- Admin Redirects page: CRUD + Shopify CSV import (`from,to,status?`) + 404
  log sorted by hits. Handles usually survive migration, so most Shopify
  `/products/:handle` rows map straight to `/:country/products/:handle` —
  store both the bare and prefixed forms, or one rule per market.
