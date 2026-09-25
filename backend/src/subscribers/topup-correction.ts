import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type {
  ICartModuleService,
  IPromotionModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { refreshPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"

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
 * Termination: the math is a deterministic integer function of stored state
 * and our writes bypass promo recomputation, so the refired event recomputes
 * identical values, hits the exact-equality check, and writes nothing.
 * At most two cycles, no timers or counters.
 */

type AdjustmentLike = {
  id: string
  item_id: string
  code?: string | null
  amount?: unknown
  promotion_id?: string | null
  description?: string | null
}

const toMinorUnits = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : NaN
}

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

  const items = (cart.items ?? []) as unknown as {
    id: string
    original_total?: unknown
    subtotal?: unknown
    is_discountable?: boolean
    adjustments?: AdjustmentLike[]
  }[]

  // Distinct promos that actually placed item adjustments on this cart.
  const promoIds = [
    ...new Set(
      items
        .flatMap((item) => item.adjustments ?? [])
        .map((adj) => adj.promotion_id)
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

  type FloorPromo = { id: string; code?: string; value: number }
  const floors: FloorPromo[] = []
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
    const value = Number(method.value)
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      logger.warn(
        `[topup] promo ${promo.code ?? promo.id} has out-of-range value ${String(
          method.value
        )} - leaving its adjustments exactly as the engine computed them`
      )
      continue
    }
    floors.push({ id: promo.id, code: promo.code, value })
  }
  if (!floors.length) {
    return { rewritten: 0 }
  }

  // Deterministic lowest-first layering: books are stable regardless of the
  // order codes were entered in.
  floors.sort((a, b) => a.value - b.value)
  const floorByPromoId = new Map(floors.map((f) => [f.id, f]))

  let rewritten = 0
  // Complete desired adjustment set, keyed by existing adjustment id.
  // setLineItemAdjustments REPLACES the cart's whole adjustment set rather
  // than merging, so every adjustment that must survive (changed or not) has
  // to be re-sent - omitting one deletes it.
  const desiredById = new Map<
    string,
    {
      id: string
      item_id: string
      code?: string
      amount: number
      promotion_id: string
      description?: string
    }
  >()
  const deletions: string[] = []

  for (const item of items) {
    const adjustments = item.adjustments ?? []
    // Protect everything first: entries not explicitly rewritten below are
    // re-sent unchanged so the replacing set() call preserves them.
    for (const adj of adjustments) {
      desiredById.set(adj.id, {
        id: adj.id,
        item_id: item.id,
        code: adj.code ?? undefined,
        amount: toMinorUnits(adj.amount ?? 0) || 0,
        promotion_id: adj.promotion_id ?? "",
        description: adj.description ?? undefined,
      })
    }
    if (item.is_discountable === false) {
      continue
    }
    const base = toMinorUnits(
      item.original_total ?? item.subtotal ?? 0
    )
    if (!Number.isFinite(base) || base <= 0) {
      continue
    }
    // Fixed (non-floor) promos keep native amounts but count toward the floor:
    // the floor is a minimum total discount, so every existing reduction helps.
    let accumulated = 0
    for (const adj of adjustments) {
      if (!adj.promotion_id || !floorByPromoId.has(adj.promotion_id)) {
        accumulated += toMinorUnits(adj.amount ?? 0) || 0
      }
    }

    for (const floor of floors) {
      const stored = adjustments.filter(
        (adj) => adj.promotion_id === floor.id
      )
      if (!stored.length) {
        // Never invent eligibility: only rescale adjustments the engine placed.
        continue
      }
      const target = Math.round((floor.value * base) / 100)
      const desired = Math.max(0, target - accumulated)
      accumulated += desired

      const storedTotal = stored.reduce(
        (sum, adj) => sum + (toMinorUnits(adj.amount ?? 0) || 0),
        0
      )
      if (storedTotal === desired) {
        continue
      }

      // Normalize to a single adjustment per (item, promo), updating in
      // place: setLineItemAdjustments is update-only (id required).
      const first = stored[0]
      for (const adj of stored.slice(1)) {
        deletions.push(adj.id)
        desiredById.delete(adj.id)
      }
      if (desired > 0) {
        desiredById.set(first.id, {
          id: first.id,
          item_id: item.id,
          code: first.code ?? floor.code ?? "",
          amount: desired,
          promotion_id: floor.id,
          description: first.description ?? undefined,
        })
      } else {
        deletions.push(first.id)
        desiredById.delete(first.id)
      }
      rewritten += 1
      logger.info(
        JSON.stringify({
          msg: "topup-correction",
          cart: cartId,
          promo: floor.code ?? floor.id,
          item: item.id,
          base,
          floor_value: floor.value,
          was: storedTotal,
          now: desired,
        })
      )
    }
  }

  if (!rewritten) {
    return { rewritten: 0 }
  }

  // Delete-then-set: deletions drop stale duplicates/zeroed rows, then the
  // complete desired set is written. If the set ever throws after deletions,
  // the next cart.updated re-runs this same pure function on actual state and
  // converges - no manual repair path exists or is needed.
  if (deletions.length) {
    await cartModuleService.deleteLineItemAdjustments(deletions)
  }
  await cartModuleService.setLineItemAdjustments(cartId, [
    ...desiredById.values(),
  ])

  // Keep payment sessions consistent with corrected totals, exactly as the
  // native promo workflow does after recomputation.
  await refreshPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: cartId },
  })

  return { rewritten }
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
