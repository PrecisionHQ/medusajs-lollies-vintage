"use client"

import { useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import {
  WishlistItem,
  getWishlist,
  removeFromWishlist,
} from "@lib/data/wishlist"
import { addToCart } from "@lib/data/cart"
import { useParams, useRouter } from "next/navigation"

/**
 * PR-07 — Shopper's wishlist page. Remove works inline; "Move to cart" adds
 * the item (default variant when none was saved — the shopper picks options
 * on the PDP for optioned products) then removes it.
 */
export default function Wishlist({ countryCode }: { countryCode: string }) {
  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    getWishlist().then(setItems)
  }, [])

  if (items === null) {
    return <p className="text-base-regular">Loading…</p>
  }

  if (items.length === 0) {
    return (
      <p className="text-base-regular">
        Nothing saved yet. Tap the heart on any product to keep it here.
      </p>
    )
  }

  const remove = async (id: string) => {
    setBusy(id)
    const res = await removeFromWishlist(id)
    if (res.ok) {
      setItems(items.filter((i) => i.id !== id))
    }
    setBusy(null)
  }

  const moveToCart = async (item: WishlistItem) => {
    setBusy(item.id)
    try {
      // Saved without a variant (optioned product): send them to choose.
      if (!item.variant_id) {
        router.push(`/${params.countryCode ?? countryCode}/products/${item.product_handle}`)
        return
      }
      await addToCart({
        variantId: item.variant_id,
        quantity: 1,
        countryCode: (params.countryCode as string) ?? countryCode,
      })
      const res = await removeFromWishlist(item.id)
      if (res.ok) {
        setItems(items.filter((i) => i.id !== item.id))
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <ul className="flex flex-col gap-y-6">
      {items.map((item) => (
        <li key={item.id} className="flex gap-x-4 items-center">
          {item.product_handle ? (
            <LocalizedClientLink href={`/products/${item.product_handle}`}>
              <Thumbnail thumbnail={item.product_thumbnail} size="small" />
            </LocalizedClientLink>
          ) : null}
          <div className="flex-1">
            <p className="font-semibold">{item.product_title ?? item.product_id}</p>
            {item.variant_title ? (
              <p className="text-ui-fg-subtle text-small-regular">{item.variant_title}</p>
            ) : null}
          </div>
          <button
            onClick={() => moveToCart(item)}
            disabled={busy === item.id}
            className="underline text-small-regular disabled:opacity-50"
          >
            Move to cart
          </button>
          <button
            onClick={() => remove(item.id)}
            disabled={busy === item.id}
            className="underline text-small-regular text-ui-fg-subtle disabled:opacity-50"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
