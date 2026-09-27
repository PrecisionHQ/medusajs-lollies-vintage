import { Metadata } from "next"
import { notFound } from "next/navigation"

import StockAlerts from "@modules/account/components/stock-alerts"
import { getCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Stock alerts",
  description: "Your back-in-stock notifications",
}

export default async function StockAlertsPage() {
  const customer = await getCustomer()

  if (!customer) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="stock-alerts-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Stock alerts</h1>
        <p className="text-base-regular">
          Products you asked to hear about when they return.
        </p>
      </div>
      <StockAlerts />
    </div>
  )
}
