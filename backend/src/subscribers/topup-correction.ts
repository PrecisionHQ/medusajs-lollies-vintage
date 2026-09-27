import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type {
  ICartModuleService,
  IPromotionModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { refreshPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  planTopUpAdjustments,
  toMinorUnits,
  type TopUpFloorInput,
  type TopUpItemInput,
} from "../lib/topup-math"

/**
 * Universal top-up floor for percentage-off-items promotions.
 *
 * Shop rule: every percentage-off-items promo tops up to its own value over
 * existing adjustments. Per-item total always equals the highest applicable
 * floor; promos never compound. There is no flag, toggle, or metadata — this
 * is simply how discounts work here, which also means it cannot be switched
 * off or tampered with at runtime.
 *
 * Why a subscriber: all promo math funnels through
 * updateCartPromotionsWorkflow (code changes AND item/refresh changes), which
 * emits cart.updated when done. The correction reads the settled native
 * result and rewrites only the amounts of adjustments the engine already
 * placed — eligibility (target rules, exclusions, campaigns) is never
 * invented, only rescaled.
 *
 * The math itself is pure and unit-tested (see ../lib/topup-math and its
 * tests); this file only maps DTOs in and out and performs the writes.
 * Termination: deterministic integer function of stored state, and writes
 * bypass promo recomputation, so the refired event recomputes identical
 * values, hits the exact-equality check, and writes nothing.
 */

export async function correctTopUpForCart(
  cartId: string,
  container: SubscriberArgs<{ id?: string }>["container"]
): Promise<{ rewritten: number }> {
  const logger = container.resolve("logger")
  const cartModuleService: ICartModuleService =
    container.resolve(Modules.CART)
  const promotionModuleService: IPromotionModuleService =
    container.resolve(Modules.PROMOTION)

  const cart = await cartModuleService.retrieveCart(cartId, {
    relations: ["items.adjustments"],
  })
  if (!cart || (cart as { completed_at?: string }).completed_at) {
    return { rewritten: 0 }
  }

  const rawItems = (cart.items ?? []) as unknown as {
    id: string
    original_total?: unknown
    subtotal?: unknown
    is_discountable?: boolean
    adjustments?: {
      id: string
      promotion_id?: string | null
      amount?: unknown
      code?: string | null
      description?: string | null
    }[]
  }[]

  const items: TopUpItemInput[] = rawItems.map((item) => ({
    id: item.id,
    base: toMinorUnits(item.original_total ?? item.subtotal ?? 0),
    discountable: item.is_discountable !== false,
    adjustments: (item.adjustments ?? []).map((adj) => ({
      id: adj.id,
      promoId: adj.promotion_id ?? null,
      amount: toMinorUnits(adj.amount ?? 0) || 0,
      code: adj.code ?? undefined,
      description: adj.description ?? undefined,
    })),
  }))

  // Distinct promos that actually placed item adjustments on this cart.
  const promoIds = [
    ...new Set(
      items
        .flatMap((item) => item.adjustments)
        .map((adj) => adj.promoId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  if (!promoIds.length) {
    return { rewritten: 0 }
  }

  const promotions = await promotionModuleService.listPromotions(
    { id: promoIds },
    { relations: ["application_method"] }
  )

  const floors: TopUpFloorInput[] = []
  for (const promo of promotions as unknown as {
    id: string
    code?: string
    application_method?: {
      type?: string
      target_type?: string
      value?: unknown
    } | null
  }[]) {
    const method = promo.application_method
    if (!method || method.type !== "percentage" || method.target_type !== "items") {
      continue
    }
    floors.push({
      id: promo.id,
      code: promo.code,
      value: Number(method.value),
    })
  }
  if (!floors.length) {
    return { rewritten: 0 }
  }

  const plan = planTopUpAdjustments(items, floors)

  for (const skipped of plan.skipped) {
    logger.warn(
      `[topup] promo ${skipped.promo} has out-of-range value ${String(
        skipped.value
      )} - leaving its adjustments exactly as the engine computed them`
    )
  }
  for (const entry of plan.audit) {
    logger.info(JSON.stringify({ msg: "topup-correction", cart: cartId, ...entry }))
  }

  if (!plan.rewritten) {
    return { rewritten: 0 }
  }

  // Delete-then-set: deletions drop stale duplicates/zeroed rows, then the
  // complete desired set is written (setLineItemAdjustments REPLACES rather
  // than merges). If the set ever throws after deletions, the next
  // cart.updated re-runs the same pure function on actual state and
  // converges - no manual repair path exists or is needed.
  if (plan.deletions.length) {
    await cartModuleService.deleteLineItemAdjustments(plan.deletions)
  }
  await cartModuleService.setLineItemAdjustments(cartId, [
    ...plan.desiredById.values(),
  ])

  // Keep payment sessions consistent with corrected totals, exactly as the
  // native promo workflow does after recomputation.
  await refreshPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: cartId },
  })

  return { rewritten: plan.rewritten }
}

async function topupCorrectionHandler({
  event,
  container,
}: SubscriberArgs<{ id?: string }>) {
  try {
    const cartId = event.data?.id
    if (!cartId) {
      return
    }
    await correctTopUpForCart(cartId, container)
  } catch (error) {
    // A failed correction must never take down the emitting workflow;
    // native stacked totals remain as the safe fallback (they favor the
    // shopper, never overcharge).
    console.error("topup correction failed:", error)
  }
}

export default topupCorrectionHandler

export const config: SubscriberConfig = {
  event: ["cart.updated"],
}
