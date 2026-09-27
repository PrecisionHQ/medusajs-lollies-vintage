import { sdk } from "@lib/config"
import { cache } from "react"

export type BundleComponent = {
  variant_id: string
  quantity: number
  variant_title: string | null
  product_title: string | null
  product_handle: string | null
  product_thumbnail: string | null
  eur_price: number | null
}

export type StoreBundle = {
  id: string
  name: string
  discount_label: string
  components: BundleComponent[]
}

/**
 * PR-08 — Public bundle definitions for the PDP rail. Cached (bundles change
 * rarely; the composer is the invalidation path via future revalidate work —
 * for now a short default cache from the data layer settings applies).
 */
export const getBundlesForProduct = cache(async function (
  productId: string
): Promise<StoreBundle[]> {
  return sdk.client
    .fetch<{ bundles: StoreBundle[] }>(`/store/bundles`, {
      method: "GET",
      query: { product_id: productId },
    })
    .then(({ bundles }) => bundles)
    .catch(() => [])
})
