import { test, expect, type Page } from "@playwright/test"
import { dismissPopups, url } from "./helpers"

/**
 * Overlay lifecycle (#6, #7, #15). The Modave theme drives modals through
 * Bootstrap, whose hide path never runs on Next.js client-side navigation.
 * Navigating from inside an open overlay used to strand a backdrop + body
 * scroll-lock on the destination page: it looked fine but was unclickable
 * until a full refresh. ModaveScripts now dismisses overlays on route
 * change, with explicit dismiss on the highest-traffic overlay links.
 *
 * Each case asserts the destination page is backdrop-free AND still
 * receives clicks (reopening the search modal proves interactivity).
 */
test.describe("Overlay lifecycle", () => {
  const openSearch = async (page: Page) => {
    await page.locator('a[href="#search"]').first().click()
    await expect(page.locator("#search.show")).toBeVisible()
  }

  const assertInteractive = async (page: Page) => {
    await expect(page.locator(".modal-backdrop")).toHaveCount(0)
    await expect(page.locator(".offcanvas-backdrop")).toHaveCount(0)
    await expect(page.locator("body.modal-open")).toHaveCount(0)
    // Reopening a modal proves clicks actually land on the page.
    await page.locator('a[href="#search"]').first().click()
    await expect(page.locator("#search.show")).toBeVisible()
    await page.keyboard.press("Escape")
  }

  test("search suggestion opens an interactive PDP", async ({ page }) => {
    await page.goto(url())
    await dismissPopups(page)
    await openSearch(page)

    await page.locator('#search input[name="text"]').fill("dress")
    const suggestion = page.locator('#search a[href*="/products/"]').first()
    await expect(suggestion).toBeVisible({ timeout: 20000 })
    await suggestion.click()

    await expect(page).toHaveURL(/\/products\//)
    await assertInteractive(page)
  })

  test("quick-view full details opens an interactive PDP", async ({
    page,
  }) => {
    await page.goto(url())
    await dismissPopups(page)
    await page.locator('a[href="#quickView"]').first().click()
    await expect(page.locator("#quickView.show")).toBeVisible()

    await page
      .locator('#quickView a[href*="/products/"]')
      .first()
      .click()
    await expect(page).toHaveURL(/\/products\//)
    await assertInteractive(page)
  })

  test("product drill-down stays interactive", async ({ page }) => {
    // Reach a PDP through search, then drill into a related product.
    await page.goto(url())
    await dismissPopups(page)
    await openSearch(page)

    await page.locator('#search input[name="text"]').fill("dress")
    const suggestion = page.locator('#search a[href*="/products/"]').first()
    await expect(suggestion).toBeVisible({ timeout: 20000 })
    await suggestion.click()
    await expect(page).toHaveURL(/\/products\//)

    const related = page.locator('a[href*="/products/"]').first()
    await expect(related).toBeVisible()
    await related.click()
    await assertInteractive(page)
  })
})
