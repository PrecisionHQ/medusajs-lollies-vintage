import { test, expect, type Page } from "@playwright/test"
import { url } from "./helpers"

/**
 * Wishlist + compare state store (#9). Both lists live in Context with
 * localStorage persistence (compare used to be session-only: a reload
 * wiped it). The header wishlist icon opens the drawer (it pointed at a
 * /wish-list route that does not exist).
 */

const openFirstProduct = async (page: Page) => {
  await page.goto(url("store"))
  const link = page.locator('a[href*="/products/"]').first()
  await expect(link).toBeVisible({ timeout: 20000 })
  await link.click()
  await expect(page).toHaveURL(/\/products\//)
}

test.describe("Wishlist and compare", () => {
  test("wishlist survives a reload and opens from the header", async ({
    page,
  }) => {
    await openFirstProduct(page)
    await page.locator(".tf-product-info-by-btn .wishlist").first().click()
    await expect(page.locator("#wishlist.show")).toBeVisible({
      timeout: 15000,
    })
    await page.keyboard.press("Escape")

    await page.reload()
    await page.locator('a[href="#wishlist"]').first().click()
    await expect(page.locator("#wishlist.show")).toBeVisible()
    await expect(
      page.locator("#wishlist .tf-mini-cart-item").first()
    ).toBeVisible({ timeout: 15000 })
  })

  test("compare survives a reload", async ({ page }) => {
    await openFirstProduct(page)
    await page.locator(".tf-product-info-by-btn .compare").first().click()
    await expect(page.locator("#compare.show")).toBeVisible({
      timeout: 15000,
    })

    await page.reload()
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("compare") || "[]")
    )
    expect(stored.length).toBeGreaterThan(0)
  })
})
