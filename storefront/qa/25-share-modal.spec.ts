import { test, expect } from "@playwright/test"
import { dismissPopups, suppressPopups, url } from "./helpers"

/**
 * Share modal (#13). The PDP trigger used to point at a modal that did
 * not exist. The modal offers WhatsApp (wa.me with the product URL) and
 * copy-link; guests see a sign-in hint for the credit, never a dead end.
 * Credit posting itself is proven live (authed) in the deploy run.
 */
test.describe("Share modal", () => {
  test("share offers WhatsApp and copy-link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-write", "clipboard-read"])
    await suppressPopups(page)
    await page.goto(url("store"))
    await dismissPopups(page)
    const link = page.locator('a[href*="/products/"]').first()
    await expect(link).toBeVisible({ timeout: 20000 })
    await link.click()
    await expect(page).toHaveURL(/\/products\//)

    await page.getByTestId("share-link").click()
    const modal = page.getByTestId("share-modal")
    await expect(modal).toBeVisible({ timeout: 15000 })

    const wa = page.getByTestId("share-whatsapp")
    await expect(wa).toBeVisible()
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\//)

    await page.getByTestId("share-copy").click()
    await expect(page.getByTestId("share-notice")).toBeVisible()
  })
})
