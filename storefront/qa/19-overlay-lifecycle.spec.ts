import { test, expect, type Page } from "@playwright/test"
import {
  dismissPopups,
  openFirstQuickView,
  openOverlay,
  suppressPopups,
  url,
} from "./helpers"

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
    await openOverlay(page, 'a[href="#search"]', "#search.show")
  }

  const assertInteractive = async (page: Page) => {
    await expect(page.locator(".modal-backdrop")).toHaveCount(0)
    await expect(page.locator(".offcanvas-backdrop")).toHaveCount(0)
    await expect(page.locator(".modal.show")).toHaveCount(0)
    await expect(page.locator(".offcanvas.show")).toHaveCount(0)
    await expect(page.locator("body.modal-open")).toHaveCount(0)
    // Reopening a modal proves clicks actually land on the page.
    await openOverlay(page, 'a[href="#search"]', "#search.show")
    await page.keyboard.press("Escape")
  }

  /**
   * Clicks a link and waits for the route to change, retrying the click
   * when it lands but React's handler is replaced mid-fade (observed
   * live: the click resolved yet the router never navigated). Link
   * clicks are idempotent, so a retry is safe and keeps a render race
   * from failing a navigation test.
   */
  const clickAndNavigate = async (
    page: Page,
    locator: ReturnType<Page["locator"]>,
    urlPattern: RegExp
  ) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await locator.first().click({ timeout: 10000 }).catch(() => {})
      if (
        await page
          .waitForURL(urlPattern, { timeout: 5000 })
          .then(() => true)
          .catch(() => false)
      ) {
        return
      }
    }
    await expect(page).toHaveURL(urlPattern)
  }

  test("search suggestion opens an interactive PDP", async ({ page }) => {
    await suppressPopups(page)
    await page.goto(url())
    await dismissPopups(page)
    await openSearch(page)

    await page.locator('#search input[name="text"]').fill("dress")
    const suggestion = page.locator('#search a[href*="/products/"]').first()
    await expect(suggestion).toBeVisible({ timeout: 20000 })
    await clickAndNavigate(page, suggestion, /\/products\//)
    await assertInteractive(page)
  })

  test("quick-view full details opens an interactive PDP", async ({
    page,
  }) => {
    await suppressPopups(page)
    await page.goto(url())
    await dismissPopups(page)
    await openFirstQuickView(page)
    await expect(page.locator("#quickView.show")).toBeVisible()
    // Let the open fade settle before clicking through the modal.
    await page.waitForTimeout(600)

    await clickAndNavigate(
      page,
      page.locator('#quickView a[href*="/products/"]'),
      /\/products\//
    )
    await assertInteractive(page)
  })

  test("product drill-down stays interactive", async ({ page }) => {
    // Reach a PDP through search, then drill into a related product.
    await suppressPopups(page)
    await page.goto(url())
    await dismissPopups(page)
    await openSearch(page)

    await page.locator('#search input[name="text"]').fill("dress")
    const suggestion = page.locator('#search a[href*="/products/"]').first()
    await expect(suggestion).toBeVisible({ timeout: 20000 })
    await clickAndNavigate(page, suggestion, /\/products\//)

    const related = page.locator('a[href*="/products/"]').first()
    await expect(related).toBeVisible()
    await clickAndNavigate(page, related, /\/products\//)
    await assertInteractive(page)
  })
})
