import { test, expect } from "@playwright/test"
import { dismissPopups, suppressPopups, url } from "./helpers"

/**
 * Ask a Question (#11). The PDP trigger used to point at a modal that did
 * not exist. Guests can ask; validation errors show inline; a good submit
 * shows the thanks state (the answer itself is written in Admin).
 */
test.describe("Ask a question", () => {
  test("guest can ask and sees validation", async ({ page }) => {
    await suppressPopups(page)
    await page.goto(url("store"))
    await dismissPopups(page)
    const link = page.locator('a[href*="/products/"]').first()
    await expect(link).toBeVisible({ timeout: 20000 })
    await link.click()
    await expect(page).toHaveURL(/\/products\//)

    await page.getByTestId("ask-question-link").click()
    const modal = page.getByTestId("ask-modal")
    await expect(modal).toBeVisible({ timeout: 15000 })

    // A well-formed email with a too-short question trips OUR validation
    // inline. (An invalid email is caught by the browser's native
    // constraint validation before the handler runs, so it can't be used
    // to exercise the server-side message.)
    await page.getByTestId("ask-name-input").fill("Quinn Tester")
    await page.getByTestId("ask-email-input").fill("quinn@example.com")
    await page.getByTestId("ask-question-input").fill("Hi?")
    await page.getByTestId("ask-submit").click()
    await expect(page.getByTestId("ask-error")).toBeVisible()

    await page
      .getByTestId("ask-question-input")
      .fill("What fabric is this made of, and is it machine washable?")
    await page.getByTestId("ask-submit").click()
    await expect(page.getByTestId("ask-success")).toBeVisible({
      timeout: 20000,
    })
  })
})
