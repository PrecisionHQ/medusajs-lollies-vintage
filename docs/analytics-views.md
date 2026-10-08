# Guest-intelligence views (Phase 2)

Companion to the Phase 1 stitching PR (`feat/analytics-identify`): once
anonymous browsing joins buyer profiles, these are the views that answer
"what are guests interested in, and what do we do about it."

**How to use this doc:** build each view in the PostHog UI exactly as
specified. A view earns a card on the admin KPI page only when someone looks
at it weekly for a month — until then it lives in PostHog. No code changes in
this PR, deliberately.

## Event taxonomy (what exists to query)

Client (`TrackView`, consented sessions only):

| Event | Properties |
|---|---|
| `store_viewed` | — |
| `collection_viewed` | `collection_id`, `handle` |
| `product_viewed` | `product_id`, `handle` |
| `cart_viewed` | `item_count` |
| `checkout_started` | — |
| `search_performed` | `query`, `result_count` |
| `order_placed` (source: `storefront`) | funnel position only |

Server (`order-placed-analytics`, reliable revenue record):

| Event | Properties |
|---|---|
| `order_placed` (source: `server`) | `order_id`, `revenue`, `currency`, `region_id`, `item_count`; person = `customer_id` \|\| email |

**Known taxonomy gap (prerequisite code tweak, not this PR):** `product_viewed`
carries no price or category, so category-affinity and price-band views need a
lookup or an event enrichment (`collection_ids`, `price_minor`) added to the
`TrackView` calls. Views below that need it are marked **[needs enrichment]**.

## The views

### 1. Viewed-never-added (per product)
- **Question:** what gets attention but never enters a cart?
- **Build:** funnel `product_viewed` → `cart_viewed` (or persons who did the first without the second in 14d), breakdown by `product_id`/`handle`, sorted by drop-off count.
- **Drives:** PDP fixes (price, imagery, size info), restock priority, bundle candidates (pairs frequently viewed together = set candidates).
- **Promote to admin when:** merchandising reviews it weekly.

### 2. Category affinity **[needs enrichment]**
- **Question:** which categories do repeat visitors orbit?
- **Build:** `product_viewed` grouped by category (post-enrichment), per-person counts over 30d; segment: 3+ views in one category, zero orders.
- **Drives:** homepage rails, collection curation, winback segmentation (dormant buyers by category).
- **Promote to admin when:** curation becomes a weekly ritual.

### 3. Search no-result terms
- **Question:** what do shoppers ask for that we don't have?
- **Build:** `search_performed` where `result_count = 0`, grouped by `query`, ordered by frequency. (Aggregate twin already exists as the admin search-no-result KPI.)
- **Drives:** buying/restock decisions, synonym/redirect additions, "notify me" prompts on empty results.
- **Promote to admin when:** already partially there — extend the existing KPI card with top terms.

### 4. Guest → buyer funnel
- **Question:** where do anonymous visitors fall out?
- **Build:** funnel `store_viewed` → `product_viewed` → `cart_viewed` → `checkout_started` → `order_placed`, conversion per step, breakdown by `region_id` (server event) and new vs returning. Requires Phase 1 stitching — without it the last step belongs to a different person.
- **Drives:** the single highest-leverage view: each step's drop-off maps to a fix (PDP, shipping-cost surprise, checkout friction).
- **Promote to admin when:** immediately — this is the KPI page's missing center.

### 5. Repeat-visitor cohorts
- **Question:** who comes back, and do they convert better?
- **Build:** cohort of persons with 2+ distinct weeks active; compare order rate vs one-and-done visitors.
- **Drives:** loyalty targeting (high-visit, low-buy = points incentive candidates), retargeting pool definitions for Phase 3.
- **Promote to admin when:** loyalty or ads work starts spending against it.

## Verification

Peer review: every event/property name above against `TrackView` call sites
and `order-placed-analytics.ts`. Re-check after any event-taxonomy change.
End-to-end numbers wait on real PostHog keys + consented traffic volume
(days/weeks of data — a data-maturity dependency, not a code one).
