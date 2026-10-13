import { test, expect } from "@playwright/test"
import { url } from "./helpers"

/**
 * Ask a Question (#11). The PDP trigger used to point at a modal that did
 * not exist. Guests can ask; validation errors show inline; a good submit
 * shows the thanks state (the answer itself is written in Admin).
 */
test.describe("Ask a question", () => {
  test("guest can ask and sees validation", async ({ page }) => {
    await page.goto(url("store"))
    const link = page.locator('a[href*="/products/"]').first()
    await expect(link).toBeVisible({ timeout: 20000 })
    await link.click()
    await expect(page).toHaveURL(/\/products\//)

    await page.getByTestId("ask-question-link").click()
    const modal = page.getByTestId("ask-modal")
    await expect(modal).toBeVisible({ timeout: 15000 })

    // Too-short question trips backend validation inline.
    await page.getByTestId("ask-name-input").fill("Quinn Tester")
    await page.getByTestId("ask-email-input").fill("not-an-email")
    await page.getByTestId("ask-question-input").fill("Hi?")
    await page.getByTestId("ask-submit").click()
    await expect(page.getByTestId("ask-error")).toBeVisible()

    await page.getByTestId("ask-email-input").fill("quinn@example.com")
    await page
      .getByTestId("ask-question-input")
      .fill("What fabric is this made of, and is it machine washable?")
    await page.getByTestId("ask-submit").click()
    await expect(page.getByTestId("ask-success")).toBeVisible({
      timeout: 20000,
    })
  })
})
