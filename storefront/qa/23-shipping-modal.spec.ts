import { test, expect } from "@playwright/test"
import { url } from "./helpers"

/**
 * PDP help modals (#12). The Delivery & Return trigger has always been on
 * the page, but no #delivery_return modal existed, so the click did
 * nothing. Now it opens, shows delivery + returns copy, and closes.
 */
test.describe("Shipping modal", () => {
  test("delivery & return opens and closes", async ({ page }) => {
    await page.goto(url("store"))
    const link = page.locator('a[href*="/products/"]').first()
    await expect(link).toBeVisible({ timeout: 20000 })
    await link.click()
    await expect(page).toHaveURL(/\/products\//)

    await page.getByTestId("delivery-return-link").click()
    const modal = page.getByTestId("shipping-modal")
    await expect(modal).toBeVisible({ timeout: 15000 })
    await expect(modal).toContainText(/12-26 days/)
    await expect(modal).toContainText(/45 days/)

    await page.getByTestId("shipping-modal-close").click()
    await expect(modal).toBeHidden()
    await expect(page.locator(".modal-backdrop")).toHaveCount(0)
  })
})
