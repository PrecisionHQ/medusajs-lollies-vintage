import { describe, expect, it } from 'vitest'
import {
  planTopUpAdjustments,
  toMinorUnits,
  type TopUpFloorInput,
  type TopUpItemInput,
} from '../topup-math'

/**
 * Unit tests for the universal top-up floor (see src/lib/topup-math.ts).
 * These encode the behaviors verified live on Railway: layered books,
 * order-independent determinism, removal re-expansion, and the guards.
 * Pure integer math only - no Medusa imports, no DB, milliseconds.
 */

const item = (
  id: string,
  base: number,
  adjustments: TopUpItemInput['adjustments'],
  discountable = true
): TopUpItemInput => ({ id, base, discountable, adjustments })

const adj = (
  id: string,
  promoId: string,
  amount: number,
  code?: string
): TopUpItemInput['adjustments'][number] => ({
  id,
  promoId,
  amount,
  code,
})

const floor = (
  id: string,
  value: number,
  code?: string
): TopUpFloorInput => ({ id, value, code })

/** Native stacked result for 30% + 40% on a 1000 base: 40% first (400),
 * then 30% of the remainder (180). */
const NATIVE_STACKED = [
  adj('a1', 'save30', 180, 'SAVE30'),
  adj('a2', 'mega40', 400, 'MEGA40'),
]

describe('toMinorUnits', () => {
  it('rounds halves up and passes integers through', () => {
    expect(toMinorUnits(10)).toBe(10)
    expect(toMinorUnits(10.5)).toBe(11)
    expect(toMinorUnits('3')).toBe(3)
  })

  it('returns NaN for non-numeric input', () => {
    expect(toMinorUnits(undefined)).toBeNaN()
    expect(toMinorUnits('abc')).toBeNaN()
  })
})

describe('layered books', () => {
  it('tops up to the highest floor: 300 + 100 on a 1000 base', () => {
    const plan = planTopUpAdjustments(
      [item('i1', 1000, NATIVE_STACKED)],
      [floor('save30', 30, 'SAVE30'), floor('mega40', 40, 'MEGA40')]
    )

    expect(plan.rewritten).toBe(2)
    expect(plan.desiredById.get('a1')).toMatchObject({
      amount: 300,
      promotion_id: 'save30',
    })
    expect(plan.desiredById.get('a2')).toMatchObject({
      amount: 100,
      promotion_id: 'mega40',
})
})
})

  it('is deterministic regardless of floor input order', () => {
    const first = planTopUpAdjustments(
      [item('i1', 1000, NATIVE_STACKED)],
      [floor('save30', 30, 'SAVE30'), floor('mega40', 40, 'MEGA40')]
    )
    const second = planTopUpAdjustments(
      [item('i1', 1000, NATIVE_STACKED)],
      [floor('mega40', 40, 'MEGA40'), floor('save30', 30, 'SAVE30')]
    )

    expect(second.desiredById).toEqual(first.desiredById)
  })

  it('expands the remaining promo to the full floor on removal', () => {
    const plan = planTopUpAdjustments(
      [item('i1', 1000, [adj('a2', 'mega40', 100, 'MEGA40')])],
      [floor('mega40', 40, 'MEGA40')]
    )

    expect(plan.rewritten).toBe(1)
    expect(plan.desiredById.get('a2')).toMatchObject({ amount: 400 })
  })

  it('is a silent no-op when stored amounts already match', () => {
    const plan = planTopUpAdjustments(
      [item('i1', 1000, [adj('a1', 'save30', 300), adj('a2', 'mega40', 100)])],
      [floor('save30', 30), floor('mega40', 40)]
    )

    expect(plan.rewritten).toBe(0)
    expect(plan.deletions).toEqual([])
  })
describe('guards', () => {
  it('never invents eligibility for promos with no placed adjustment', () => {
    const plan = planTopUpAdjustments(
      [item('i1', 1000, [adj('a1', 'save30', 300)])],
      [floor('save30', 30), floor('mega40', 40)]
    )

    expect(plan.rewritten).toBe(0)
    expect(plan.desiredById.has('a1')).toBe(true)
  })

  it('counts fixed (non-floor) promos toward the floor', () => {
    const plan = planTopUpAdjustments(
      [
        item('i1', 1000, [
          { id: 'f1', promoId: null, amount: 900 },
          adj('a2', 'mega40', 400, 'MEGA40'),
        ]),
      ],
      [floor('mega40', 40, 'MEGA40')]
    )

    // 900 already exceeds the 400 floor: the promo adjustment is removed.
    expect(plan.rewritten).toBe(1)
    expect(plan.deletions).toContain('a2')
    expect(plan.desiredById.has('a2')).toBe(false)
    // The fixed reduction itself is protected, not deleted.
    expect(plan.desiredById.get('f1')).toMatchObject({ amount: 900 })
  })

  it('skips non-discountable items entirely', () => {
    const plan = planTopUpAdjustments(
      [item('i1', 1000, NATIVE_STACKED, false)],
      [floor('save30', 30), floor('mega40', 40)]
    )

    expect(plan.rewritten).toBe(0)
    // Protected: re-sent unchanged so the replacing set() preserves them.
    expect(plan.desiredById.get('a1')).toMatchObject({ amount: 180 })
  })

  it('skips zero or invalid bases', () => {
    for (const base of [0, -5, NaN]) {
      const plan = planTopUpAdjustments(
        [item('i1', base, NATIVE_STACKED)],
        [floor('save30', 30), floor('mega40', 40)]
      )
      expect(plan.rewritten).toBe(0)
    }
  })

  it('skips out-of-range floor values loudly, leaving native amounts', () => {
    const plan = planTopUpAdjustments(
      [item('i1', 1000, [adj('a9', 'wild', 500, 'WILD150')])],
      [floor('wild', 150, 'WILD150'), floor('zero', 0, 'ZERO')]
    )

    expect(plan.rewritten).toBe(0)
    expect(plan.skipped.map((s) => s.promo)).toEqual(
      expect.arrayContaining(['WILD150', 'ZERO'])
    )
    expect(plan.desiredById.get('a9')).toMatchObject({ amount: 500 })
  })

  it('normalizes duplicate adjustments per (item, promo) to one', () => {
    const plan = planTopUpAdjustments(
      [
        item('i1', 1000, [
          adj('a1', 'save30', 100),
          adj('a2', 'save30', 80),
        ]),
      ],
      [floor('save30', 30)]
    )

    expect(plan.rewritten).toBe(1)
    expect(plan.desiredById.get('a1')).toMatchObject({ amount: 300 })
    expect(plan.deletions).toContain('a2')
  })
})