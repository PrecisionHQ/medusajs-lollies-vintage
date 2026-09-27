# CMS module — proposed flow & architecture

## Recommendation up front

**Medusa-native Content module** (`backend/src/modules/content`), not an external CMS. Reasons, grounded in this repo:

* Single Railway deploy stays intact — no extra service to provision/wire like Postgres/Redis/Meili/S3 already are in `medusa-config.js`.
* Matches existing pattern: custom admin widget (`promotion-exclusions.tsx`) + custom admin/store API routes (`src/api/admin/promotions/...`, `src/api/store/carts/...`) — a Content module follows the same shape.
* One admin login (`:9000/app`), media stays on the existing S3 file provider, search stays on the Meili `products` index in `src/search/products.ts`.
* External CMS (Sanity/Contentful) buys better visual editing, but costs a second admin, webhook sync, preview infra, and Railway wiring. Only worth it if non-technical editors need rich page-building weekly.

## Proposed content model

```
Page (handle, title, locale, status: draft|published, publish_at, seo_title/meta/og_image)
 └─ Section[] (ordered: sort_order, slot e.g. "home.hero" / "home.grid" / "collection.footer")
      ├─ type: hero | banner | product_rail | rich_text | image_grid | faq | testimonial
      ├─ data: JSONB per-type payload (headline, cta, copy, config)
      ├─ links: product_ids[] / collection_ids[] / category_ids[] (resolved via links, not copied)
      └─ media: file URLs from existing S3 provider
```

Start minimal: `Page + Section`. Homepage = Page with handle `home`. No versioning in v1 (status + `publish_at` covers scheduling); add versions only if editors overwrite each other.

## Flow

```
Editor (Medusa admin → Content → Pages)
  → create/edit Page + Sections (block editor, link picker for products/collections)
  → Save draft / Publish (or schedule via publish_at)
  → publish event → workflow: validate links → purge/storefront revalidate tag `content:{handle}`
  → Storefront (Next 15): lib/data/content.ts fetches /store/content/{handle} (cached, tagged)
  → BlockRenderer maps section.type → component (hero/, banner/, product-rail/...)
  → fallback: if no published Page, render current hardcoded sections (safe deploy)
Preview: draft token → /preview/{handle}?token=… bypasses cache, noindex
```

## Architecture pieces

1. **Backend module** `src/modules/content/`: Mikro-ORM models (Page, Section), service (`ContentModuleService`), links to Product/Collection/Category. Migrations via `medusa db:migrate`. Follows `email-notifications/index.ts` provider pattern but as a full module (models + service + links).
2. **Admin API** `src/api/admin/content/*`: CRUD + publish/unpublish + reorder sections + link resolution. Reuses the `authHeaders()` + cookie-cred pattern from the exclusions widget.
3. **Admin UI**: custom route `src/admin/routes/content/*` (page list, page editor with section add/reorder, link picker querying existing catalog, live preview iframe). Widget optional on collection detail ("footer content for this collection").
4. **Store API** `src/api/store/content/[handle]/route.ts`: published-only, locale-aware, embeds resolved products/collections (price/region context preserved), cache headers.
5. **Storefront**: `src/lib/data/content.ts` (mirrors `collections.ts` `cache()` + `getCacheDirectives` pattern), `BlockRenderer` in `modules/content/`, replace `<Hero />` placeholder in `(main)/page.tsx` with content-driven sections. `revalidateTag` webhook from backend workflow. Draft preview route with token auth.
6. **Cross-cutting**: media → existing S3 provider (no new storage); SEO fields → `metadata` in page.tsx; i18n → `locale` column matching regions (`gb/de/dk/se/fr/es/it` in `seed.ts`); search untouched (CMS copy not indexed in v1 — flag if Meili page indexing wanted later); RBAC via Medusa admin roles; audit via publish events → subscriber.

## Phases

* **P1**: Page+Section models, admin CRUD, store API, homepage hero/banner driven by CMS, fallback preserved.
* **P2**: scheduling, preview links, product_rail/image_grid/faq blocks, collection-slot sections.
* **P3 (only if needed)**: versioning, Meili page index, locale fallback chains.

## Open questions

1. Homepage only first, or also collection footers / landing pages / blog-type pages?
2. Do editors need scheduled publishing + preview links in v1, or is draft/publish enough?
3. Any hard requirement for a visual external editor (Sanity-style), or is editing inside Medusa admin acceptable?
