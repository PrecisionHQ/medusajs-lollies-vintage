"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { StoreBundle, getBundlesForProduct } from "@lib/data/bundles"
import { addToCart } from "@lib/data/cart"

/**
 * PR-08 — "Complete the set" rail: other bundles containing this product,
 * with one-click add-all. The buy-get discount applies automatically in the
 * cart — no code needed.
 */
export default function BundleSection({ productId }: { productId: string }) {
  const [bundles, setBundles] = useState<StoreBundle[] | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const params = useParams()
  const countryCode = params.countryCode as string

  useEffect(() => {
    getBundlesForProduct(productId).then(setBundles)
  }, [productId])

  if (!bundles || bundles.length === 0) {
    return null
  }

  const addAll = async (bundle: StoreBundle) => {
    setAdding(bundle.id)
    try {
      for (const c of bundle.components) {
        await addToCart({
          variantId: c.variant_id,
          quantity: c.quantity,
          countryCode,
        })
      }
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="content-container py-12">
      {bundles.map((bundle) => (
        <div key={bundle.id} className="border-t border-ui-border-base py-8">
          <h2 className="text-2xl-semi mb-1">{bundle.name}</h2>
          <p className="text-ui-fg-subtle text-small-regular mb-6">
            {bundle.discount_label} — applied automatically when the full set
            is in your cart.
          </p>
          <ul className="grid grid-cols-2 small:grid-cols-4 gap-x-6 gap-y-6 mb-6">
            {bundle.components.map((c) => (
              <li key={c.variant_id}>
                {c.product_handle ? (
                  <LocalizedClientLink href={`/products/${c.product_handle}`}>
                    <Thumbnail thumbnail={c.product_thumbnail} size="square" />
                    <p className="text-small-regular font-semibold mt-2">
                      {c.product_title}
                    </p>
                  </LocalizedClientLink>
                ) : (
                  <p>{c.variant_id}</p>
                )}
                <p className="text-small-regular text-ui-fg-subtle">
                  {c.variant_title} × {c.quantity}
                </p>
              </li>
            ))}
          </ul>
          <button
            onClick={() => addAll(bundle)}
            disabled={adding === bundle.id}
            className="bg-ui-fg-base text-ui-fg-on-inverted rounded px-6 py-2 disabled:opacity-50"
          >
            {adding === bundle.id ? "Adding…" : `Add the set (${bundle.components.reduce((a, c) => a + c.quantity, 0)} items)`}
          </button>
        </div>
      ))}
    </div>
  )
}
