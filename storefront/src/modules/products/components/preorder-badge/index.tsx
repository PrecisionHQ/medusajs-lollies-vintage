"use client"

import { useEffect, useState } from "react"

import { PreorderFlag, getPreorderFlags } from "@lib/data/preorders"

/**
 * PR-09 — Preorder badge + disclosure for the selected variant. Rendered
 * under Add to cart when the variant is flagged: ETA plus the honest money
 * line (authorized now, captured on shipment).
 */
export default function PreorderBadge({
  productId,
  variantId,
}: {
  productId: string
  variantId?: string | null
}) {
  const [flag, setFlag] = useState<PreorderFlag | null>(null)

  useEffect(() => {
    getPreorderFlags({ productId }).then((flags) => {
      setFlag((variantId && flags[variantId]) || null)
    })
  }, [productId, variantId])

  if (!flag || !variantId) {
    return null
  }

  return (
    <div className="border border-ui-border-strong rounded p-3 text-small-regular">
      <p className="font-semibold">Preorder — {flag.eta_text}</p>
      <p className="text-ui-fg-subtle">
        Your payment is authorized now and captured only when your order ships.
        Cancelling releases the authorization.
      </p>
    </div>
  )
}
