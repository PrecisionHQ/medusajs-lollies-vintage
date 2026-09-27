import { Metadata } from "next"
import { notFound } from "next/navigation"

import Loyalty from "@modules/account/components/loyalty"
import { getCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Loyalty",
  description: "Your points and rewards",
}

export default async function LoyaltyPage() {
  const customer = await getCustomer()

  if (!customer) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="loyalty-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Loyalty</h1>
        <p className="text-base-regular">Points, rewards and history.</p>
      </div>
      <Loyalty />
    </div>
  )
}
