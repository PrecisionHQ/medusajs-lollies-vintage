import { test, expect } from "@playwright/test"

/**
 * The footer used to render the Modave theme's demo dropdowns (hardcoded
 * USD/VND, English/Vietnam) that changed nothing and disagreed with the
 * region the shopper was actually in. It now shows the live region —
 * country, currency and language — resolved from the URL's country prefix
 * against the backend's regions.
 */
test.describe("Footer region indicator", () => {
  test("shows the truthful region on a GBP page", async ({ page }) => {
    await page.goto("/gb/")

    const region = page.getByTestId("footer-region")
    await expect(region).toBeVisible()

    await expect(page.getByTestId("footer-region-country")).toContainText(
      "United Kingdom"
    )
    await expect(page.getByTestId("footer-region-currency")).toContainText(
      "GBP"
    )
    await expect(page.getByTestId("footer-region-language")).toContainText(
      "English"
    )

    // The old demo dropdowns must be gone, not just supplemented.
    await expect(region).not.toContainText("VND")
    await expect(region).not.toContainText("Vietnam")
  })

  test("follows the URL country on a EUR page", async ({ page }) => {
    await page.goto("/de/")

    await expect(page.getByTestId("footer-region-country")).toContainText(
      "Germany"
    )
    await expect(page.getByTestId("footer-region-currency")).toContainText(
      "EUR"
    )
  })
})
