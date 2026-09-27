"use client"

import { useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "@lib/data/wishlist"

/**
 * PR-07 — Heart toggle for the PDP. Loads the shopper's list on mount to set
 * initial state; guests get a login link instead of a toggle.
 */
export default function WishlistButton({
  productId,
  variantId,
}: {
  productId: string
  variantId?: string | null
}) {
  const [savedId, setSavedId] = useState<string | null>(null)
  const [guest, setGuest] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getWishlist().then((items) => {
      if (items === null) {
        setGuest(true)
        return
      }
      const match = items.find(
        (i) => i.product_id === productId && (i.variant_id ?? null) === (variantId ?? null)
      )
      setSavedId(match?.id ?? null)
    })
  }, [productId, variantId])

  const toggle = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    if (savedId) {
      const res = await removeFromWishlist(savedId)
      if (res.ok) {
        setSavedId(null)
      }
    } else {
      const res = await addToWishlist(productId, variantId)
      if (res.ok) {
        const items = await getWishlist()
        const match = items?.find(
          (i) => i.product_id === productId && (i.variant_id ?? null) === (variantId ?? null)
        )
        setSavedId(match?.id ?? "saved")
      } else if (res.error === "signin") {
        setGuest(true)
      }
    }
    setBusy(false)
  }

  if (guest) {
    return (
      <p className="text-small-regular text-ui-fg-subtle">
        <LocalizedClientLink href="/account" className="underline">
          Sign in
        </LocalizedClientLink>{" "}
        to save this to your wishlist.
      </p>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={savedId ? "Remove from wishlist" : "Save to wishlist"}
      className="text-xl leading-none disabled:opacity-50"
    >
      {savedId ? "♥" : "♡"}
    </button>
  )
}
