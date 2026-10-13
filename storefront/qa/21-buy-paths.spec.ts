import { test, expect, type Page } from "@playwright/test"
import { url } from "./helpers"

/**
 * Buy paths (#2, #10). Add-to-cart opens the live cart drawer (the same
 * #shoppingCart surface the header cart icon opens, badge in sync, with
 * View-cart / Checkout links to the full pages). Buy It Now skips the cart
 * page and lands straight in the checkout flow with the item present.
 */

const openFirstProduct = async (page: Page) => {
  await page.goto(url("store"))
  const link = page.locator('a[href*="/products/"]').first()
  await expect(link).toBeVisible({ timeout: 20000 })
  const title = (await link.textContent())?.trim()
  await link.click()
  await expect(page).toHaveURL(/\/products\//)
  return title
}

/** Resolve a purchasable variant by picking the first value per group. */
const selectFirstVariant = async (page: Page) => {
  const groups = page.locator(".variant-picker-item")
  for (let i = 0; i < (await groups.count()); i++) {
    const group = groups.nth(i)
    const values = group.locator("[data-value]")
    for (let j = 0; j < (await values.count()); j++) {
      const candidate = values.nth(j)
      if ((await candidate.getAttribute("data-value"))?.trim()) {
        await candidate.click()
        break
      }
    }
  }
}

test.describe("Buy paths", () => {
  test("add-to-cart opens the cart drawer linked to the header", async ({
    page,
  }) => {
    const title = await openFirstProduct(page)
    await selectFirstVariant(page)

    await page.locator(".btn-add-to-cart").first().click()
    await expect(page.locator("#shoppingCart.show")).toBeVisible({
      timeout: 20000,
    })
    if (title) {
      await expect(page.locator("#shoppingCart")).toContainText(
        title.slice(0, 24)
      )
    }
    // Header badge tracks the drawer contents.
    await expect(page.locator(".count-box").first()).not.toBeEmpty()
  })

  test("buy-it-now lands in checkout with the item", async ({ page }) => {
    await openFirstProduct(page)
    await selectFirstVariant(page)

    await page.getByTestId("buy-it-now-button").click()
    await expect(page).toHaveURL(/\/checkout/, { timeout: 30000 })
    // Address step is the flow entry: the item rode along, no empty-cart bounce.
    await expect(
      page.getByTestId("shipping-first-name-input")
    ).toBeVisible({ timeout: 20000 })
  })
})
