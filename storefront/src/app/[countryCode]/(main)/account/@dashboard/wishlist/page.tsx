import { Metadata } from "next"
import { notFound } from "next/navigation"

import Wishlist from "@modules/account/components/wishlist"
import { getCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your saved products",
}

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const customer = await getCustomer()

  if (!customer) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="wishlist-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Wishlist</h1>
        <p className="text-base-regular">
          Everything you&apos;ve saved for later.
        </p>
      </div>
      <Wishlist countryCode={countryCode} />
    </div>
  )
}
