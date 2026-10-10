"use server"

import { retrieveCart } from "./cart"
import { getCartRecommendationProducts } from "@lib/util/recommendations"
import { adaptMedusaProductsToModave } from "@lib/util/modave-product-adapter"

/**
 * P8 — Cart drawer recommendations as live cards. Reads the shopper's own
 * cart server-side (cookie), scores a pool by cart affinity, adapts.
 * Empty cart (or any failure) yields curated picks or nothing — never throws.
 */
export async function getCartRecommendations(
  countryCode: string,
  limit = 4
) {
  try {
    const cart = await retrieveCart().catch(() => null)
    const ids = ((cart?.items || []) as { product_id?: string }[])
      .map((i) => i.product_id)
      .filter((id): id is string => !!id)
    const products = await getCartRecommendationProducts(ids, countryCode, limit)
    return adaptMedusaProductsToModave(products, countryCode)
  } catch {
    return []
  }
}
