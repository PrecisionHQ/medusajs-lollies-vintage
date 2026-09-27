import { Metadata } from "next"
import CartTemplate from "@modules/cart/templates"
import PreorderNotice from "@modules/cart/components/preorder-notice"
import TrackView from "@modules/common/components/track-view"

import { enrichLineItems, retrieveCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { getCustomer } from "@lib/data/customer"

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

export default async function Cart() {
  const cart = await fetchCart()
  const customer = await getCustomer()

  return (
    <>
      <TrackView
        event="cart_viewed"
        properties={{ item_count: cart?.items?.length ?? 0 }}
      />
      <PreorderNotice
        variantIds={(cart?.items ?? [])
          .map((i) => i.variant_id)
          .filter((v): v is string => !!v)}
      />
      <CartTemplate cart={cart} customer={customer} />
    </>
  )
}
