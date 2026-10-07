import { test, expect } from "@playwright/test"

/**
 * The footer and the mobile drawer used to render the Modave theme's demo
 * dropdowns (hardcoded USD/VND, English/Vietnam) that changed nothing and
 * disagreed with the region the shopper was actually in. Both now show the
 * live region — country, currency and language — resolved from the URL's
 * country prefix against the backend's regions.
 *
 * Both surfaces share the same component, so both copies carry the same
 * testids: every assertion below is scoped to its landmark (footer element
 * vs #mobileMenu drawer) to avoid matching the other copy.
 */
test.describe("Footer region indicator", () => {
  test("shows the truthful region on a GBP page", async ({ page }) => {
    await page.goto("/gb/")

    const region = page.locator("footer").getByTestId("footer-region")
    await expect(region).toBeVisible()

    await expect(
      page.locator("footer").getByTestId("footer-region-country")
    ).toContainText("United Kingdom")
    await expect(
      page.locator("footer").getByTestId("footer-region-currency")
    ).toContainText("GBP")
    await expect(
      page.locator("footer").getByTestId("footer-region-language")
    ).toContainText("English")

    // The old demo dropdowns must be gone, not just supplemented.
    await expect(region).not.toContainText("VND")
    await expect(region).not.toContainText("Vietnam")
  })

  test("follows the URL country on a EUR page", async ({ page }) => {
    await page.goto("/de/")

    await expect(
      page.locator("footer").getByTestId("footer-region-country")
    ).toContainText("Germany")
    await expect(
      page.locator("footer").getByTestId("footer-region-currency")
    ).toContainText("EUR")
  })
})

test.describe("Mobile drawer region indicator", () => {
  // No mobile viewport needed: the drawer content is mounted (so its region
  // resolves) but hidden until opened, and it renders identically at every
  // width. Text assertions don't need visibility, which keeps this
  // independent of the Bootstrap offcanvas animation.
  test("drawer shows the truthful region without the demo dropdowns", async ({
    page,
  }) => {
    await page.goto("/gb/")

    const drawer = page.locator("#mobileMenu")
    await expect(
      drawer.getByTestId("footer-region-country")
    ).toContainText("United Kingdom")
    await expect(
      drawer.getByTestId("footer-region-currency")
    ).toContainText("GBP")
    await expect(drawer.getByTestId("footer-region")).not.toContainText(
      "VND"
    )
    await expect(drawer.getByTestId("footer-region")).not.toContainText(
      "Vietnam"
    )
  })
})
