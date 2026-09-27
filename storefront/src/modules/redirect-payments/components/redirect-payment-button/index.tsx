"use client"

import { Button } from "@medusajs/ui"
import React, { useState } from "react"

/**
 * Shared redirect-checkout button for hosted payment providers (Polar,
 * Dodo). The backend session data carries the provider-hosted checkout URL;
 * clicking leaves for the provider and returns to the payment-return page,
 * which completes the order. Lift with modules/redirect-payments on a
 * template swap.
 */
const RedirectPaymentButton: React.FC<{
  checkoutUrl?: string | null
  label: string
  notReady?: boolean
  "data-testid"?: string
}> = ({ checkoutUrl, label, notReady, "data-testid": dataTestId }) => {
  const [redirecting, setRedirecting] = useState(false)

  if (!checkoutUrl) {
    return <Button disabled>Select a payment method</Button>
  }

  return (
    <Button
      disabled={notReady || redirecting}
      isLoading={redirecting}
      size="large"
      data-testid={dataTestId}
      onClick={() => {
        setRedirecting(true)
        window.location.href = checkoutUrl
      }}
    >
      {label}
    </Button>
  )
}

export default RedirectPaymentButton
