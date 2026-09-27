/**
 * Pure top-up floor math (no I/O, no Medusa imports).
 *
 * Shop rule: every percentage-off-items promo tops up to its own value over
 * existing adjustments. Per-item total always equals the highest applicable
 * floor; promos never compound. Deterministic lowest-first layering keeps
 * books stable regardless of the order codes were entered in.
 *
 * Separated from the subscriber so it runs under vitest in CI. The
 * subscriber (`../subscribers/topup-correction`) only maps DTOs in and out
 * and performs the writes this function plans.
 */

export const toMinorUnits = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : NaN
}

export type TopUpAdjustmentInput = {
  id: string
  promoId: string | null
  amount: number
  code?: string
  description?: string
}

export type TopUpItemInput = {
  id: string
  /** Pre-discount line total, minor units. NaN/<=0 items are skipped. */
  base: number
  discountable: boolean
  adjustments: TopUpAdjustmentInput[]
}

export type TopUpFloorInput = {
  id: string
  code?: string
  /** Percent, e.g. 40 for 40%. Out-of-range values are skipped, loudly. */
  value: number
}

export type DesiredAdjustment = {
  id: string
  item_id: string
  code?: string
  amount: number
  promotion_id: string
  description?: string
}

export type TopUpAuditEntry = {
  promo: string
  item: string
  base: number
  floor_value: number
  was: number
  now: number
}

export type TopUpPlan = {
  /** Complete desired set by adjustment id. Re-sent wholesale because
   * setLineItemAdjustments REPLACES rather than merges. */
  desiredById: Map<string, DesiredAdjustment>
  deletions: string[]
  rewritten: number
  audit: TopUpAuditEntry[]
  skipped: { promo: string; value: number }[]
}

export function planTopUpAdjustments(
  items: TopUpItemInput[],
  floors: TopUpFloorInput[]
): TopUpPlan {
  const validFloors = floors.filter((floor) => {
    const ok =
      Number.isFinite(floor.value) && floor.value > 0 && floor.value <= 100
    return ok
  })
  const skipped = floors
    .filter(
      (floor) =>
        !Number.isFinite(floor.value) || floor.value <= 0 || floor.value > 100
    )
    .map((floor) => ({ promo: floor.code ?? floor.id, value: floor.value }))

  // Deterministic lowest-first layering: books are stable regardless of the
  // order codes were entered in.
  const ordered = [...validFloors].sort((a, b) => a.value - b.value)
  const floorByPromoId = new Map(ordered.map((f) => [f.id, f]))

  const desiredById = new Map<string, DesiredAdjustment>()
  const deletions: string[] = []
  const audit: TopUpAuditEntry[] = []
  let rewritten = 0

  for (const item of items) {
    const adjustments = item.adjustments ?? []
    // Protect everything first: entries not explicitly rewritten below are
    // re-sent unchanged so the replacing set() call preserves them.
    for (const adj of adjustments) {
      desiredById.set(adj.id, {
        id: adj.id,
        item_id: item.id,
        code: adj.code,
        amount: adj.amount,
        promotion_id: adj.promoId ?? "",
        description: adj.description,
      })
    }
    if (!item.discountable) {
      continue
    }
    const base = item.base
    if (!Number.isFinite(base) || base <= 0) {
      continue
    }

    // Fixed (non-floor) promos keep native amounts but count toward the
    // floor: the floor is a minimum total discount, so every existing
    // reduction helps.
    let accumulated = 0
    for (const adj of adjustments) {
      if (!adj.promoId || !floorByPromoId.has(adj.promoId)) {
        accumulated += adj.amount
      }
    }

    for (const floor of ordered) {
      const stored = adjustments.filter((adj) => adj.promoId === floor.id)
      if (!stored.length) {
        // Never invent eligibility: only rescale adjustments the engine placed.
        continue
      }
      const target = Math.round((floor.value * base) / 100)
      const desired = Math.max(0, target - accumulated)
      accumulated += desired

      const storedTotal = stored.reduce((sum, adj) => sum + adj.amount, 0)
      if (storedTotal === desired) {
        continue
      }

      // Normalize to a single adjustment per (item, promo).
      const first = stored[0]
      for (const adj of stored.slice(1)) {
        deletions.push(adj.id)
        desiredById.delete(adj.id)
      }
      if (desired > 0) {
        desiredById.set(first.id, {
          id: first.id,
          item_id: item.id,
          code: first.code ?? floor.code,
          amount: desired,
          promotion_id: floor.id,
          description: first.description,
        })
      } else {
        deletions.push(first.id)
        desiredById.delete(first.id)
      }
      rewritten += 1
      audit.push({
        promo: floor.code ?? floor.id,
        item: item.id,
        base,
        floor_value: floor.value,
        was: storedTotal,
        now: desired,
      })
    }
  }

  return { desiredById, deletions, rewritten, audit, skipped }
}
