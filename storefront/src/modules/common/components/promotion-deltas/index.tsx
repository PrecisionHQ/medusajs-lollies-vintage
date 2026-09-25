import { convertToLocale } from "@lib/util/money"

type AdjustmentLike = {
  code?: string | null
  amount?: number | null
}

type PromotionDeltasProps = {
  items?: { adjustments?: AdjustmentLike[] | null }[] | null
  /** True when at least one promotion code is applied on the cart/order. */
  promotionsApplied?: boolean
  currency_code: string
}

/**
 * Per-coupon savings breakdown, derived from the line-item adjustments the
 * backend computed (grouped by promotion code). Complements the aggregate
 * discount total: with stacked or topped-up coupons the nominal percentages
 * don't add up, but these rows always reconcile to the actual money saved.
 *
 * Zero-contribution codes are hidden; when codes are applied yet nothing was
 * discounted (e.g. every item already meets the floor), a single notice is
 * shown instead so an applied code never looks silently broken.
 */
const PromotionDeltas = ({
  items,
  promotionsApplied,
  currency_code,
}: PromotionDeltasProps) => {
  const totals = new Map<string, number>()
  for (const item of items ?? []) {
    for (const adjustment of item.adjustments ?? []) {
      if (!adjustment?.code) {
        continue
      }
      const amount = Number(adjustment.amount ?? 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        continue
      }
      totals.set(adjustment.code, (totals.get(adjustment.code) ?? 0) + amount)
    }
  }

  const rows = [...totals.entries()].filter(([, amount]) => amount > 0)

  if (!rows.length) {
    if (promotionsApplied) {
      return (
        <div className="flex items-center justify-between">
          <span data-testid="promo-delta-notice">
            Promotion applied: your items already reflect the full discount.
          </span>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col gap-y-1">
      {rows.map(([code, amount]) => (
        <div
          key={code}
          className="flex items-center justify-between"
          data-testid="promo-delta-row"
          data-code={code}
          data-value={amount}
        >
          <span>{code}</span>
          <span className="text-ui-fg-interactive">
            - {convertToLocale({ amount, currency_code })}
          </span>
        </div>
      ))}
    </div>
  )
}

export default PromotionDeltas
