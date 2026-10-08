import { test, expect } from "@playwright/test"
import { uniqueEmail } from "./helpers"

/**
 * The newsletter popup must not nag visitors who already subscribed (either
 * form sets a localStorage flag; the popup checks it before its 2.5s timer).
 */
test.describe("Newsletter popup suppression", () => {
  test("stays hidden when the visitor already subscribed", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lollies_newsletter_subscribed", "1")
    })
    await page.goto("/gb/")

    // The modal element is always mounted; .show is what Bootstrap adds.
    // Wait past the 2.5s popup timer so a regression (check moved after the
    // delay, or dropped) actually fails instead of passing vacuously.
    await expect(page.locator("#newsletterPopup")).toBeAttached()
    await page.waitForTimeout(3500)
    await expect(page.locator("#newsletterPopup")).not.toHaveClass(/show/)
  })

  test("subscribing via the footer sets the suppression flag", async ({
    page,
  }) => {
    await page.goto("/gb/")

    // Submit via requestSubmit: the auto-popup can overlay the footer while
    // it animates in, which makes a real click flaky ("element is not
    // stable"). The submit handler runs identically either way.
    const form = page.locator("footer form.form-newsletter")
    await form.locator('input[name="email"]').fill(uniqueEmail("nl"))
    await form.evaluate((f: HTMLFormElement) => f.requestSubmit())

    await expect
      .poll(async () =>
        page.evaluate(() =>
          localStorage.getItem("lollies_newsletter_subscribed")
        )
      )
      .toBe("1")
  })
})
