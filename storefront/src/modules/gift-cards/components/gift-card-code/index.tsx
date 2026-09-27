"use client"

import { Badge, Heading, Input, Label, Text } from "@medusajs/ui"
import React from "react"

import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import {
  applyGiftCard,
  listAppliedGiftCards,
  removeGiftCard,
  type AppliedGiftCard,
} from "@modules/gift-cards/actions"

type GiftCardCodeProps = {
  cart: HttpTypes.StoreCart
  currencyCode: string
}

/**
 * Gift card code entry + applied list. Mirrors <DiscountCode> on purpose so
 * both coupon types behave identically; resolves codes from the cart's
 * credit lines on mount (credit lines carry reference_id, not the code).
 * Part of the isolated gift-cards carry-over block - see actions.ts.
 */
const GiftCardCode: React.FC<GiftCardCodeProps> = ({
  cart,
  currencyCode,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [applied, setApplied] = React.useState<AppliedGiftCard[]>([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(() => {
    setLoading(true)
    listAppliedGiftCards(
      cart.credit_lines as {
        reference?: string | null
        reference_id?: string | null
        amount?: number | null
      }[]
    )
      .then(setApplied)
      .catch(() => setApplied([]))
      .finally(() => setLoading(false))
  }, [cart])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const addGiftCardCode = async (formData: FormData) => {
    setErrorMessage("")
    const code = formData.get("code")
    if (!code) {
      return
    }
    const input = document.getElementById(
      "gift-card-input"
    ) as HTMLInputElement | null

    try {
      await applyGiftCard(code.toString())
      refresh()
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Could not apply gift card.")
    }

    if (input) {
      input.value = ""
    }
  }

  const removeGiftCardCode = async (code: string) => {
    setErrorMessage("")
    try {
      await removeGiftCard(code)
      refresh()
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Could not remove gift card.")
    }
  }

  return (
    <div className="w-full bg-white flex flex-col">
      <div className="txt-medium">
        <form action={(a) => addGiftCardCode(a)} className="w-full mb-5">
          <Label className="flex gap-x-1 my-2 items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="txt-medium text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="add-gift-card-button"
            >
              Add Gift Card
            </button>
          </Label>

          {isOpen && (
            <>
              <div className="flex w-full gap-x-2">
                <Input
                  className="size-full"
                  id="gift-card-input"
                  name="code"
                  type="text"
                  autoFocus={false}
                  data-testid="gift-card-input"
                />
                <SubmitButton
                  variant="secondary"
                  data-testid="gift-card-apply-button"
                >
                  Apply
                </SubmitButton>
              </div>

              <ErrorMessage
                error={errorMessage}
                data-testid="gift-card-error-message"
              />
            </>
          )}
        </form>

        {!loading && applied.length > 0 && (
          <div className="w-full flex items-center">
            <div className="flex flex-col w-full">
              <Heading className="txt-medium mb-2">
                Gift card(s) applied:
              </Heading>

              {applied.map((giftCard) => (
                <div
                  key={giftCard.code}
                  className="flex items-center justify-between w-full max-w-full mb-2"
                  data-testid="gift-card-row"
                >
                  <Text className="flex gap-x-1 items-baseline txt-small-plus w-4/5 pr-1">
                    <span
                      className="truncate"
                      data-testid="gift-card-code"
                    >
                      <Badge color="green" size="small">
                        {giftCard.code}
                      </Badge>{" "}
                      (
                      {convertToLocale({
                        amount: giftCard.amount,
                        currency_code: currencyCode,
                      })}
                      )
                    </span>
                  </Text>
                  <button
                    className="flex items-center"
                    onClick={() => removeGiftCardCode(giftCard.code)}
                    data-testid="remove-gift-card-button"
                  >
                    <Trash size={14} />
                    <span className="sr-only">
                      Remove gift card from order
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GiftCardCode
