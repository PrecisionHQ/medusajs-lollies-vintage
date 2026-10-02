import { Metadata } from "next"

import ShopCartLive from "@/components/otherPages/ShopCartLive"
import ModavePageShell from "@/components/common/ModavePageShell"
import PreorderNotice from "@modules/cart/components/preorder-notice"
import TrackView from "@modules/common/components/track-view"

import { enrichLineItems, retrieveCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import "@/app/modave-theme.css"

export const metadata: Metadata = {
  title: "Cart",
  description: "View your cart",
}

const fetchCart = async () => {
  const cart = await retrieveCart()

  if (!cart) {
    return null
  }

  if (cart?.items?.length) {
    const enrichedItems = await enrichLineItems(cart?.items, cart?.region_id!)
    cart.items = enrichedItems as HttpTypes.StoreCartLineItem[]
  }

  return cart
}

export default async function Cart({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const cart = await fetchCart()

  return (
    <ModavePageShell countryCode={countryCode}>
      <TrackView
        event="cart_viewed"
        properties={{ item_count: cart?.items?.length ?? 0 }}
      />
      <PreorderNotice
        variantIds={(cart?.items ?? [])
          .map((i) => i.variant_id)
          .filter((v): v is string => !!v)}
      />
      <ShopCartLive cart={cart} countryCode={countryCode} />
    </ModavePageShell>
  )
}
