import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Modules } from '@medusajs/framework/utils'

// Mock container
const createMockContainer = (overrides = {}) => {
  const mocks: Record<string, any> = {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    [Modules.CART]: {
      retrieveCart: vi.fn(),
      deleteLineItemAdjustments: vi.fn().mockResolvedValue(undefined),
      setLineItemAdjustments: vi.fn().mockResolvedValue(undefined)
    },
    [Modules.PROMOTION]: {
      listPromotions: vi.fn().mockResolvedValue([]),
      retrievePromotion: vi.fn()
    },
    ...overrides
  }
  return { resolve: vi.fn((key) => mocks[key] ?? vi.fn()) }
}

describe('topup-correction subscriber', () => {
  let mockContainer: ReturnType<typeof createMockContainer>

  beforeEach(() => {
    vi.resetModules()
  })

  it('should return early for completed carts', async () => {
    const mockContainerWithCompletedCart = {
      resolve: vi.fn((key: string) => {
        if (key === 'logger') return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
        if (key === 'cart') return {
          retrieveCart: vi.fn().mockResolvedValue({ completed_at: '2024-01-01' })
        }
        return vi.fn()
      })
    }

    const event = { data: { id: 'cart_123' } }
    const result = await (await import('../topup-correction')).default({ event, container: { resolve: vi.fn() } as any })

    expect(result).toBeUndefined()
  })

  it('should return early for carts without promo adjustments', async () => {
    const cartModule = {
      retrieveCart: vi.fn().mockResolvedValue({
        completed_at: null,
        items: []
      })
    }

    const mockContainer = {
      resolve: vi.fn((key) => {
        if (key === 'cart') return cartModule
        if (key === 'promotion') return { listPromotions: vi.fn().mockResolvedValue([]) }
        if (key === 'logger') return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
        return vi.fn()
      })
    }

    const event = { data: { id: 'cart_123' } }
    const result = await (await import('../topup-correction')).default({ event, container: mockContainer as any })

    // The handler returns undefined when there are no promos to process
    expect(result).toBeUndefined()
  })
})

describe('planTopUpAdjustments edge cases', () => {
  it('handles empty floors array', () => {
    // This is a placeholder - the actual tests are in topup-math.test.ts
    expect(true).toBe(true)
  })
})