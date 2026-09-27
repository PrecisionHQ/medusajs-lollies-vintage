import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { MedusaContainer } from '@medusajs/framework'
import { createMedusaContainer } from '@medusajs/test-utils'
import { Modules } from '@medusajs/framework/utils'

/**
 * Test container singleton for integration tests.
 * Reuses a single Medusa container across tests for performance.
 */
let testContainer: MedusaContainer | null = null

export async function getTestContainer(): Promise<MedusaContainer> {
  if (!testContainer) {
    testContainer = await createMedusaContainer({
      // Use test database URL from env or fallback
      databaseUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      logger: { 
        info: () => {}, 
        warn: () => {}, 
        error: console.error,
        debug: () => {}
      }
    })
  }
  return testContainer
}

export async function closeTestContainer(): Promise<void> {
  if (testContainer) {
    await testContainer.destroy()
    testContainer = null
  }
}

/**
 * Test data factories for creating consistent test data.
 * These create entities in the database using Medusa's module services.
 */

export async function createTestRegion(container: MedusaContainer, overrides = {}) {
  const regionModule = container.resolve(Modules.REGION)
  return regionModule.createRegions([{
    name: 'Test Region',
    currency_code: 'eur',
    countries: ['de'],
    payment_providers: ['pp_system_default'],
    ...overrides
  }])
}

export async function createTestCustomer(container: MedusaContainer, overrides = {}) {
  const customerModule = container.resolve(Modules.CUSTOMER)
  return customerModule.createCustomers([{
    email: `test-${Date.now()}@example.com`,
    first_name: 'Test',
    last_name: 'User',
    ...overrides
  }])
}

export async function createTestProduct(container: MedusaContainer, overrides = {}) {
  const productModule = container.resolve(Modules.PRODUCT)
  return productModule.createProducts([{
    title: `Test Product ${Date.now()}`,
    handle: `test-product-${Date.now()}`,
    status: 'published',
    ...overrides
  }])
}

export async function createTestPromotion(container: MedusaContainer, overrides = {}) {
  const promotionModule = container.resolve(Modules.PROMOTION)
  return promotionModule.createPromotions([{
    code: `TEST-${Date.now()}`,
    type: 'standard',
    status: 'active',
    application_method: {
      type: 'percentage',
      target_type: 'items',
      allocation: 'across',
      value: 10,
      currency_code: 'eur'
    },
    ...overrides
  }])
}

export async function createTestGiftCard(container: MedusaContainer, overrides = {}) {
  const loyaltyModule = container.resolve('loyalty')
  return loyaltyModule.createGiftCards([{
    code: `TEST-${Date.now()}`,
    value: 50,
    currency_code: 'eur',
    ...overrides
  }])[0]
}

/**
 * Test utilities for common assertions
 */
export function expectValidCart(cart: any) {
  expect(cart).toBeDefined()
  expect(cart.id).toBeDefined()
  expect(cart.items).toBeDefined()
  expect(Array.isArray(cart.items)).toBe(true)
}

export function expectValidPromotion(promo: any) {
  expect(promo).toBeDefined()
  expect(promo.id).toBeDefined()
  expect(promo.code).toBeDefined()
  expect(promo.status).toBe('active')
}

export function expectValidOrder(order: any) {
  expect(order).toBeDefined()
  expect(order.id).toBeDefined()
  expect(order.items).toBeDefined()
}

/**
 * Mock container for unit tests that don't need database
 */
export function createMockContainer(overrides = {}) {
  return {
    resolve: vi.fn((key) => {
      const mocks: Record<string, any> = {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        },
        ...overrides
      }
      return mocks[key] || vi.fn()
    })
  }
}

/**
 * Create a test cart with items
 */
export async function createTestCart(container: MedusaContainer, items = []) {
  const cartModule = container.resolve(Modules.CART)
  const region = await createTestRegion({})
  
  const cart = await cartModule.createCarts([{
    region_id: region[0].id,
    email: 'test@example.com',
    currency_code: 'eur'
  }])

  for (const item of items) {
    const product = await createTestProduct({})
    await container.resolve(Modules.CART).createLineItems([{
      cart_id: cart.id,
      variant_id: product.variants[0].id,
      quantity: 1
    }])
  }

  return cartModule.retrieveCart(cart.id, { relations: ['items', 'promotions', 'items.adjustments'] })
}

/**
 * Cleanup utilities
 */
export async function cleanupTestData(container: MedusaContainer) {
  // Add cleanup logic here if needed
  // For now, we rely on database truncation or test database isolation
}

export { beforeAll, afterAll, beforeEach, afterEach, vi, describe, it, expect } from 'vitest'