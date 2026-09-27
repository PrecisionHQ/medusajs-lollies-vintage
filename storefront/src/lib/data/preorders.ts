import { sdk } from "@lib/config"
import { cache } from "react"

export type PreorderFlag = {
  available_at: string | null
  eta_text: string | null
}

/**
 * PR-09 — Preorder flags (variant metadata surfaced through the store
 * preorders route, which is the contract — store DTOs don't guarantee
 * metadata). Cached; flags change rarely (admin action).
 */
export const getPreorderFlags = cache(async function (params: {
  productId?: string
  variantIds?: string[]
}): Promise<Record<string, PreorderFlag>> {
  const query: Record<string, string> = {}
  if (params.productId) {
    query.product_id = params.productId
  }
  if (params.variantIds?.length) {
    query.variant_ids = params.variantIds.join(",")
  }
  if (Object.keys(query).length === 0) {
    return {}
  }
  return sdk.client
    .fetch<{ flags: Record<string, PreorderFlag> }>(`/store/preorders`, {
      method: "GET",
      query,
    })
    .then(({ flags }) => flags)
    .catch(() => ({}))
})
