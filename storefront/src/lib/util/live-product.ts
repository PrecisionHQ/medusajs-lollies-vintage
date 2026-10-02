/**
 * Client-safe live product fetching for Modave modals (compare, quick
 * view, wishlist). Uses the public Store API directly — no server actions,
 * no cookies — so it works from any client component on any page.
 *
 * Prices need a region: the region id is resolved once per countryCode
 * from the public regions endpoint and cached in memory.
 */
import {
  adaptMedusaProductsToModave,
  ModaveCardProduct,
} from "./modave-product-adapter"

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
).replace(/\/$/, "")
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

const regionCache = new Map<string, Promise<string | null>>()

function getRegionId(countryCode: string): Promise<string | null> {
  const cc = (countryCode || "gb").toLowerCase()
  if (!regionCache.has(cc)) {
    regionCache.set(
      cc,
      fetch(`${BACKEND_URL}/store/regions?limit=100`, {
        headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
      })
        .then((r) => (r.ok ? r.json() : { regions: [] }))
        .then((d) => {
          const region = (d.regions || []).find((r: any) =>
            (r.countries || []).some(
              (c: any) => (c.iso_2 || "").toLowerCase() === cc
            )
          )
          return region?.id ?? null
        })
        .catch(() => null)
    )
  }
  return regionCache.get(cc)!
}

async function fetchByHandle(handle: string, regionId: string | null) {
  const params = new URLSearchParams({ handle, limit: "1" })
  if (regionId) {
    params.set("region_id", regionId)
    params.set("fields", "*variants.calculated_price")
  }
  const res = await fetch(`${BACKEND_URL}/store/products?${params}`, {
    headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.products || [])[0] ?? null
}

export async function fetchLiveProductByHandle(
  handle: string,
  countryCode: string
) {
  if (!handle) return null
  try {
    const regionId = await getRegionId(countryCode)
    return await fetchByHandle(handle, regionId)
  } catch {
    return null
  }
}

export function getRegionIdCached(countryCode: string) {
  return getRegionId(countryCode)
}

export async function fetchLatestCards(
  limit: number,
  countryCode: string
): Promise<ModaveCardProduct[]> {
  try {
    const regionId = await getRegionId(countryCode)
    const params = new URLSearchParams({
      limit: String(Math.max(limit, 1)),
    })
    if (regionId) {
      params.set("region_id", regionId)
      params.set("fields", "*variants.calculated_price")
    }
    const res = await fetch(`${BACKEND_URL}/store/products?${params}`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    })
    if (!res.ok) return []
    const data = await res.json()
    return adaptMedusaProductsToModave(data.products || [], countryCode)
  } catch {
    return []
  }
}
export async function fetchLiveCardsByHandles(
  handles: string[],
  countryCode: string
): Promise<ModaveCardProduct[]> {
  const unique = [...new Set((handles || []).filter(Boolean))]
  if (!unique.length) return []
  try {
    const regionId = await getRegionId(countryCode)
    const products = (
      await Promise.all(unique.map((h) => fetchByHandle(h, regionId)))
    ).filter(Boolean)
    return adaptMedusaProductsToModave(products as any[], countryCode)
  } catch {
    return []
  }
}
