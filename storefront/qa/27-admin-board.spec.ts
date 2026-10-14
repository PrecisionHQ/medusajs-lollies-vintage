import { test, expect, Page } from "@playwright/test"
import { qaEnv } from "./helpers"

/**
 * Admin halves of the status work (#16 phone board, #5 marketing flows,
 * #17 module icons). Same credentials as qa/10; read-only throughout.
 */
const adminLogin = async (page: Page) => {
  await page.goto(`${qaEnv.adminURL}/login`)
  await page.locator('input[name="email"]').fill(qaEnv.adminEmail)
  await page.locator('input[name="password"]').fill(qaEnv.adminPassword)
  await page.getByRole("button", { name: /continue with email/i }).click()
  await expect(page).toHaveURL(/\/app(\/|$)(?!login)/, { timeout: 60_000 })
}

test.describe("Admin status boards", () => {
  test("the phone board renders its read-only summary", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${qaEnv.adminURL}/phone`)
    await expect(
      page.getByRole("heading", { name: /Today · \d+ orders/ }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("heading", { name: "Needs you" })).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Stock alerts \(\d+\)/ }),
    ).toBeVisible()
  })

  test("the flows board lists the marketing flows", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${qaEnv.adminURL}/flows`)
    await expect(
      page.getByRole("heading", { name: "Marketing Automation" }),
    ).toBeVisible({ timeout: 20_000 })
  })

  test("the sidebar exposes the module routes", async ({ page }) => {
    await adminLogin(page)
    for (const label of ["Phone", "Marketing Automation", "Questions"]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }),
      ).toBeVisible({ timeout: 20_000 })
    }
  })
})
