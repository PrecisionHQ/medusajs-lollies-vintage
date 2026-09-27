"use client"

import { Heading, Text } from "@medusajs/ui"
import { useParams } from "next/navigation"
import React, { useEffect, useState } from "react"

import { placeOrder } from "@lib/data/cart"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Shared return page for redirect-checkout providers (Polar, Dodo).
 * Point POLAR_SUCCESS_URL / DODO_RETURN_URL at
 * /<country>/payment-return?provider=polar (or dodo).
 *
 * Completing the order triggers authorizePayment, which verifies the
 * provider checkout status via API. On success placeOrder redirects to the
 * order confirmation itself. If the webhook already completed the cart, the
 * shopper lands here with nothing left to complete - the fallback message
 * covers that race (order confirmation arrives by email).
 */
const PaymentReturnPage: React.FC = () => {
  const params = useParams()
  const countryCode = params.countryCode as string

  const [status, setStatus] = useState<"working" | "done" | "error">("working")
  const [message, setMessage] = useState("Confirming your payment…")

  useEffect(() => {
    placeOrder()
      .then(() => {
        // placeOrder redirects to order/confirmed on success, so reaching
        // here means the cart needed no completion (e.g. webhook won).
        setStatus("done")
        setMessage(
          "Your order is confirmed. A confirmation email is on its way."
        )
      })
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : ""
        if (/already completed|completed/i.test(text)) {
          setStatus("done")
          setMessage(
            "Your order is confirmed. A confirmation email is on its way."
          )
          return
        }
        setStatus("error")
        setMessage(
          text ||
            "We could not confirm your payment yet. If money left your account, it will show up shortly - otherwise try checkout again."
        )
      })
    // Run once on return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-y-4 py-24">
      <Heading level="h1">
        {status === "error" ? "Payment needs attention" : "Thank you"}
      </Heading>
      <Text data-testid="payment-return-message">{message}</Text>
      {status !== "working" && (
        <LocalizedClientLink
          href={status === "error" ? "/checkout?step=payment" : `/${countryCode}`}
        >
          {status === "error" ? "Back to checkout" : "Continue shopping"}
        </LocalizedClientLink>
      )}
    </div>
  )
}

export default PaymentReturnPage
