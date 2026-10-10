import { getProductsList, getProductsById } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { topPicks as curatedTopPicks } from "@/data/curated"

/**
 * P8 — Rules-first recommendations.
 *
 * One scorer, two surfaces (PDP related, cart drawer). Signals available
 * today: same collection (+3), shared tags (+1 each), merchant-curated
 * picks (+2). Dormant weights (coview/copurchase/priceBand, all 0) are
 * reserved for P5/P7 event volume — flipping them on needs no
 * restructuring, only data. scoreProducts is pure: feed it fixtures.
 */

export const REC_WEIGHTS = {
  collection: 3,
  tag: 1,
  curated: 2,
  coview: 0,
  copurchase: 0,
  priceBand: 0,
} as const

export type ScorableProduct = {
  id: string
  collection_id?: string | null
  tags?: { id: string }[] | null
}

export type SeedSignal = {
  collectionIds: string[]
  tagIds: string[]
  excludeIds?: string[]
  /** Event-driven extras (P5/P7 volume flips these on). */
  coviewIds?: string[]
  copurchaseIds?: string[]
}

export function scoreProducts<T extends ScorableProduct>(
  seed: SeedSignal,
  products: T[],
  curatedIds: string[] = []
): { product: T; score: number }[] {
  const excluded = new Set(seed.excludeIds || [])
  const collections = new Set(seed.collectionIds)
  const tags = new Set(seed.tagIds)
  const curated = new Set(curatedIds)
  const coview = new Set(seed.coviewIds || [])
  const copurchase = new Set(seed.copurchaseIds || [])

  return products
    .filter((p) => p?.id && !excluded.has(p.id))
    .map((p) => {
      let score = 0
      if (p.collection_id && collections.has(p.collection_id)) {
        score += REC_WEIGHTS.collection
      }
      for (const t of p.tags || []) {
        if (t?.id && tags.has(t.id)) {
          score += REC_WEIGHTS.tag
        }
      }
      if (curated.has(p.id)) {
        score += REC_WEIGHTS.curated
      }
      if (coview.has(p.id)) {
        score += REC_WEIGHTS.coview
      }
      if (copurchase.has(p.id)) {
        score += REC_WEIGHTS.copurchase
      }
      return { product: p, score }
    })
    .sort((a, b) => b.score - a.score)
}

function seedFromProducts(
  seeds: ScorableProduct[],
  excludeIds: string[] = []
): SeedSignal {
  const collectionIds: string[] = []
  const tagIds: string[] = []
  for (const s of seeds) {
    if (s.collection_id && !collectionIds.includes(s.collection_id)) {
      collectionIds.push(s.collection_id)
    }
    for (const t of s.tags || []) {
      if (t?.id && !tagIds.includes(t.id)) {
        tagIds.push(t.id)
      }
    }
  }
  return { collectionIds, tagIds, excludeIds }
}

async function curatedProducts(
  countryCode: string,
  limit: number
): Promise<any[]> {
  try {
    const ids: string[] = (curatedTopPicks || []).slice(0, Math.max(limit, 1))
    if (!ids.length) return []
    const region = await getRegion(countryCode)
    if (!region) return []
    const products = await getProductsById({ ids, regionId: region.id })
    const order = new Map(ids.map((id, i) => [id, i]))
    return [...(products || [])].sort(
      (a: any, b: any) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)
    )
  } catch {
    return []
  }
}

/**
 * PDP "Related Products": same-collection pool, tag-overlap fill, curated
 * fill — scored, self excluded. Replaces the single AND-query (collection
 * AND tags), which was so narrow it often returned little.
 */
export async function getRelatedProducts(
  product: any,
  countryCode: string,
  limit = 8
): Promise<any[]> {
  try {
    const pool: any[] = []
    const seen = new Set<string>([product.id])
    const take = async (queryParams: Record<string, unknown>, n: number) => {
      if (pool.length >= n) return
      const { response } = await getProductsList({
        queryParams: { ...queryParams, limit: n },
        countryCode,
      }).catch(() => ({ response: { products: [] } }))
      for (const p of response.products || []) {
        if (p?.id && !seen.has(p.id)) {
          seen.add(p.id)
          pool.push(p)
        }
      }
    }

    if (product.collection_id) {
      await take({ collection_id: [product.collection_id] }, 24)
    }
    const tagIds = (product.tags || [])
      .map((t: any) => t?.id)
      .filter(Boolean)
    if (tagIds.length) {
      await take({ tag_id: tagIds }, 24)
    }
    if (pool.length < limit) {
      for (const p of await curatedProducts(countryCode, limit)) {
        if (p?.id && !seen.has(p.id)) {
          seen.add(p.id)
          pool.push(p)
        }
        if (pool.length >= limit) break
      }
    }
    // Final backstop: latest products, so thinly-categorized seeds still
    // render a full row (matches the old unfiltered-list floor).
    if (pool.length < limit) {
      await take({}, limit)
    }
    if (!pool.length) return []

    const seed = seedFromProducts([product], [product.id])
    return scoreProducts(seed, pool, curatedTopPicks || [])
      .slice(0, limit)
      .map((r) => r.product)
  } catch {
    return []
  }
}

/**
 * Cart drawer recommendations: affinity to what's in the cart (shared
 * collections/tags), in-cart items excluded. Empty cart falls back to
 * curated picks (strictly better than recency).
 */
export async function getCartRecommendationProducts(
  cartProductIds: string[],
  countryCode: string,
  limit = 4
): Promise<any[]> {
  try {
    const ids = [...new Set((cartProductIds || []).filter(Boolean))]
    const region = await getRegion(countryCode).catch(() => null)
    const seedProducts =
      ids.length && region
        ? (((await getProductsById({ ids, regionId: region.id }).catch(
            () => []
          )) as any[]) || [])
        : []
    // Empty cart, unknown ids, or thin pool: curated first, latest fill.
    if (!seedProducts.length) {
      const cur = await curatedProducts(countryCode, limit)
      const seen = new Set(cur.map((p: any) => p?.id))
      if (cur.length < limit) {
        const { response } = await getProductsList({
          queryParams: { limit },
          countryCode,
        }).catch(() => ({ response: { products: [] } }))
        for (const p of response.products || []) {
          if (p?.id && !seen.has(p.id)) {
            seen.add(p.id)
            cur.push(p)
          }
          if (cur.length >= limit) break
        }
      }
      return cur.slice(0, limit)
    }

    const { response } = await getProductsList({
      queryParams: { limit: 32 },
      countryCode,
    }).catch(() => ({ response: { products: [] } }))
    const pool = (response.products || []).filter(
      (p: any) => p?.id && !ids.includes(p.id)
    )
    if (!pool.length) return []

    const seed = seedFromProducts(seedProducts, ids)
    return scoreProducts(seed, pool, curatedTopPicks || [])
      .slice(0, limit)
      .map((r) => r.product)
  } catch {
    return []
  }
}
