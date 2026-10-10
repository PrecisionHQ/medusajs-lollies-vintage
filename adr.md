# Architecture Decision Records — Lollies Vintage (Medusa on Railway)

Living log of the load-bearing decisions behind this work. Newest last. Each
entry: context, decision, consequences. Nothing here is hypothetical — every
item was verified live on Railway unless marked otherwise.

## ADR-001 — Monorepo: backend + storefront in one repo and one Railway project

- **Context:** The fork (`PrecisionHQ/medusajs-lollies-vintage`) already ships
  backend + Next.js starter. A custom ecommerce template may replace the
  storefront later.
- **Decision:** Keep the monorepo. One Railway project, shared env/CORS, one
  PR covering API + UI. A custom template lands as a folder (e.g.
  `storefront-custom/`), not a new repo. Separate repo only on independent
  versioning or a separate team.
- **Consequences:** Railway uploads are per-directory (`railway up` from
  `backend/` or `storefront/` with `--path-as-root`); directory↔service
  linkage must be checked after cross-service commands (an `up --service`
  once silently repointed the link).

## ADR-002 — Universal top-up floor replaces stacking, with no flags

- **Context:** Requirement: one site-wide coupon acts as a floor (e.g. 40%);
  already-discounted items get only the delta. Medusa natively only stacks
  or skips.
- **Decision:** Every percentage-off-items promo tops up to its own value
  over existing adjustments; per-item total always equals the highest
  applicable floor. No `is_top_up` flag, toggle, or metadata — it is simply
  how discounts work, so it cannot be switched off or tampered with at
  runtime. Deterministic lowest-first layering keeps books stable regardless
  of entry order.
- **Consequences:** Stacking disappears shop-wide by design (newsletter 10% +
  sale 20% = 20%, not 28%). Attribution follows layering order ($15 + $25
  style rows). Pre-tax item-level basis.

## ADR-003 — Correction lives in a subscriber on `cart.updated`

- **Context:** All promo math funnels through `updateCartPromotionsWorkflow`
  (code changes AND item/refresh changes — verified in 2.19 sources), so a
  route-only override would be wiped on the next cart change.
- **Decision:** A `cart.updated` subscriber rewrites top-up adjustment
  amounts after native recompute settles. Observe-mode deploy proved
  `cart.updated` is the only cart event that fires; latency is sub-second
  (apparent delay was Railway log batching).
- **Consequences:** Pure integer math (minor units), exact-equality no-op
  (terminates in ≤2 cycles), payment collection refreshed like native,
  structured audit log per rewrite. Failure mode favors the shopper (native
  stacked totals remain), never overcharges.

## ADR-004 — Synchronous apply-code route for settled totals at entry

- **Context:** Subscriber correction is async; code entry is the moment the
  shopper judges the price.
- **Decision:** Thin override of `POST/DELETE /store/carts/:id/promotions`
  (same path, so core middlewares still apply): native workflow, then
  correction inline and awaited, then refetch. Native errors pass through
  byte-identical.
- **Consequences:** Settled totals in the code-entry response. Item-add
  flashes stay async (self-healing, movement expected). Thin surface must be
  diffed against upstream on every Medusa bump (checklist in completion.md).

## ADR-005 — Exclusions as one `ne` rule per product

- **Context:** Excluded items must keep their own promos while skipping the
  site-wide one.
- **Decision:** One `ne` target rule per excluded product on
  `items.product.id`, managed in the promo section (widget + admin API
  route). `nin` does not exist as a 2.19 operator — verified against the
  type definitions, not assumed.
- **Consequences:** Works with native recompute and the top-up correction
  untouched. Admin-managed, no seeds, no env vars.

## ADR-006 — `setLineItemAdjustments` replaces; always write complete sets

- **Context:** Combined exclusion+top-up test showed adjustments vanishing.
- **Decision:** Verified live: the call REPLACES the cart's whole adjustment
  set — omitting one deletes it. The correction therefore always writes the
  complete desired state (changed + protected-unchanged).
- **Consequences:** Any future caller of that method must do the same. Noted
  here so nobody relearns it the hard way.

## ADR-007 — Official plugins over custom builds

- **Context:** Gift cards (absent from v2 core) and search needed backends.
- **Decision:** `@medusajs/loyalty-plugin@2.19.0` (version-matched, peers
  align) for gift cards/store credit; `@rokmohar/medusa-plugin-meilisearch`
  behind Medusa's own Search Module for search. Custom code only where no
  plugin exists (promo correction, payment providers).
- **Consequences:** Upgrade path follows upstream; plugin quirks owned
  explicitly (e.g. Meili primary-key inference, `search_index` below).

## ADR-008 — Every-boot migrate (fixing the `seedOnce` gate)

- **Context:** `launch-utils seedOnce` runs `db:migrate` only on first seed,
  so modules enabled later never get tables (`search_index` missing broke
  reindex).
- **Decision:** `start` runs `medusa db:migrate && medusa db:sync-links`
  every boot (new `migrate` script). Both are idempotent no-ops when current.
- **Consequences:** Future modules migrate cleanly. Standard Medusa deploy
  practice; no reseeding risk (seed script itself stays once-only).

## ADR-009 — Redirect-checkout payment providers, stubbed until keyed

- **Context:** No off-shelf Medusa providers for Polar or Dodo; both are
  redirect-first (PayPal shape).
- **Decision:** Custom `pp_polar` (ad-hoc fixed prices — arbitrary totals
  confirmed) and `pp_dodo` (PWYW product + explicit amount — VERIFY against
  live keys, mirroring fallback documented) providers, registered only when
  their env vars are present. Shared redirect button + return page complete
  orders on return; webhooks complete async. Refunds: Dodo attempted via
  stored payment id, Polar via dashboard (documented).
- **Consequences:** Zero checkout behavior change until real keys land. Live
  checkout + webhook proof still required per provider. Local provider dirs
  must export `{ services: [...] }` from `index.ts` (bare class crashes the
  loader); Polar TS SDK is camelCase outbound-snake.

## ADR-010 — Secrets live in Railway variables, never in git

- **Context:** JWT/cookie secrets, admin password, Meili keys, (future)
  PSP and email keys.
- **Decision:** Generated/stored in Railway service variables and the work
  session only. Scans before every push; `.env.template` carries stubs.
  The publishable key in docs is public by design (ships in the storefront
  bundle).
- **Consequences:** No secret rotation needed on repo exposure. Test
  credentials that can't be deleted (no admin delete route) are
  expired-neutralized instead.

## ADR-011 — Storefront additions stay carry-over isolated

- **Context:** The storefront will be replaced by a custom ecommerce
  template later.
- **Decision:** All new shopper-facing code lives in dedicated modules
  (`modules/gift-cards/`, `modules/redirect-payments/`, `PromotionDeltas`
  adjacent); existing files get only marked one-line insertions. Facet
  checkbox UI deliberately skipped.
- **Consequences:** A template swap lifts whole folders. Option titles (not
  just values) and facet UI remain future enhancements.

## ADR-012 — Campaigns for validity windows and budgets (budgets off)

- **Context:** Promos need durations; spend exposure needs a ceiling.
- **Decision:** Validity = native campaign start/end dates (dashboard
  supported, UTC read-back gate after creation). Campaign *spend* budgets
  stay untouched per explicit call. Expiry locks at cart state (no
  in-flight checkout kills).
- **Consequences:** One campaign per promo for independent durations.
  Margin protection beyond per-item caps is still an open business decision.

## ADR-013 — Ad pixels ride the PostHog consent gate, fail closed

- **Context:** Meta/TikTok pixels needed wiring without creating a second privacy regime. Ad-blockers also remove pixel globals at the network level.
- **Decision:** Pixels load and fire only on the existing `lollies_consent === accepted` signal; missing/placeholder IDs keep everything inert; no autocapture anywhere — a pure mapper turns our funnel events into platform events, and every access is guarded so a blocked pixel can never break shopping.
- **Consequences:** No events flow until real IDs are configured (currently inert on prod by design). Browser/server Purchase pairs share the order id so Meta dedupes them.

## ADR-014 — MedusaService `update` takes data-with-id, never (selector, data)

- **Context:** Sixteen call sites across custom modules used `updateX(selector, data)`. The generated method signature is `update(data)` — selector-shaped first args either threw `id "" not found` or silently updated nothing (campaign flips, flow saves, loyalty earn, review votes, 404 counters all dead).
- **Decision:** Always pass a single `{ id, ...patch }` object (array form where batching); normalize the return instead of blind-destructuring.
- **Consequences:** Fixed at all 16 sites in P3; verified live (flip persists, save round-trips, counter increments). Any future `updateX(a, b)` call is a bug on sight.

## ADR-015 — Never name a route directory `test`

- **Context:** A `campaigns/[id]/test/route.ts` endpoint typechecked, built, and deployed — then 404'd on prod while its sibling `preview/` worked. The compiled `.medusa` output simply omitted the directory.
- **Decision:** Medusa's builder silently drops route dirs named `test`. Name test endpoints `test-send` (or similar) and treat any future 404-on-a-compiled-route as a build-output check first (`find .medusa -path ...`), not a code bug.

## ADR-016 — Interest signals are explicit interactions only

- **Context:** P8 recommendations need behavioral data. The cheap version is scroll-depth/dwell-time tracking or autocapture-everything; both are surveillance-shaped and hard to explain in a privacy notice.
- **Decision:** Only deliberate actions become events — wishlist-add, compare-add, review submit/vote, applied search filters, and the existing funnel (view/cart/checkout/order). No scroll, no dwell, no autocapture. Review events stay PostHog-only (no ad-platform use-case); wishlist/compare map to retargetable pixel events.
- **Consequences:** Sparser signal than behavioral tracking, but every event is defensible consent-wise and directly usable for scoring. Time-on-page style questions stay unanswerable by design.

## ADR-017 — Recommendations are scored rules with dormant event weights

- **Context:** Cart drawer showed newest products; PDP related was one unranked AND-query. Real co-view/purchase scoring needs PostHog keys + event volume that don't exist yet.
- **Decision:** One pure scorer (collection +3, tag +1, curated +2) with coview/copurchase/priceBand weights present but zeroed. Surfaces read top-N of score order with stable ties; thin pools backstop to curated then latest so rows always render full.
- **Consequences:** Ships value with zero data dependencies; turning on event scoring later is a weights + data change, no restructuring. Ranking only — no UI redesign per surface.
