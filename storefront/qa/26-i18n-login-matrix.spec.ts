import { test, expect, type Page } from "@playwright/test"
import {
  assertSignedIn,
  dismissPopups,
  newCustomer,
  suppressPopups,
  type TestCustomer,
} from "./helpers"
import { resolveLocale } from "../src/i18n/config"
import { countryLocale } from "../src/i18n/country-locale"
import en from "../src/i18n/dictionaries/en.json"
import fr from "../src/i18n/dictionaries/fr.json"
import de from "../src/i18n/dictionaries/de.json"
import es from "../src/i18n/dictionaries/es.json"
import it from "../src/i18n/dictionaries/it.json"
import nl from "../src/i18n/dictionaries/nl.json"
import pt from "../src/i18n/dictionaries/pt.json"
import da from "../src/i18n/dictionaries/da.json"
import sv from "../src/i18n/dictionaries/sv.json"

/**
 * i18n login matrix (#1). Behavior is unchanged by design (display locale
 * follows the URL country, EN toggle persists via cookie): this locks it
 * in across 10 countries, including login. Cases skip — loudly, not red —
 * when the target env has no region for a country (local seed covers 7;
 * production covers all 10).
 */

const DICTS: Record<string, any> = { en, fr, de, es, it, nl, pt, da, sv }
const COUNTRIES = ["gb", "de", "fr", "es", "it", "nl", "se", "dk", "ie", "pt"]

const modalTitle = (page: Page) => page.locator("#search h5").first()

async function gotoCountry(page: Page, cc: string): Promise<boolean> {
  await suppressPopups(page)
  await page.goto(`/${cc}`)
  await dismissPopups(page)
  // Unknown-to-the-backend countries 307 to the default region.
  return page.url().includes(`/${cc}`)
}

/** Country-scoped registration (the shared helper pins qaEnv.region). */
async function registerAt(page: Page, cc: string, customer: TestCustomer) {
  await suppressPopups(page)
  await page.goto(`/${cc}/account`)
  await dismissPopups(page)
  await page.getByTestId("register-button").click()
  await expect(page.getByTestId("register-page")).toBeVisible()
  await page.getByTestId("first-name-input").fill(customer.firstName)
  await page.getByTestId("last-name-input").fill(customer.lastName)
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("register-button").click()
  await assertSignedIn(page)
}

for (const cc of COUNTRIES) {
  test.describe(`i18n ${cc}`, () => {
    test(`serves the ${cc} locale`, async ({ page }) => {
      test.skip(!(await gotoCountry(page, cc)), `no region for ${cc} here`)
      const expected = resolveLocale(cc, null)
      await page.locator('a[href="#search"]').first().click()
      await expect(page.locator("#search.show")).toBeVisible()
      await expect(modalTitle(page)).toHaveText(
        DICTS[expected].search.modalTitle
      )
      await page.keyboard.press("Escape")
    })

    test(`login keeps the ${cc} locale`, async ({ page }) => {
      test.skip(!(await gotoCountry(page, cc)), `no region for ${cc} here`)
      const expected = resolveLocale(cc, null)
      await registerAt(page, cc, newCustomer(`i18n-${cc}`))
      // Registration stays in-country and keeps the locale chrome.
      expect(page.url()).toContain(`/${cc}/account`)
      await page.goto(`/${cc}`)
      await dismissPopups(page)
      await page.locator('a[href="#search"]').first().click()
      await expect(page.locator("#search.show")).toBeVisible()
      await expect(modalTitle(page)).toHaveText(
        DICTS[expected].search.modalTitle
      )
      await page.keyboard.press("Escape")
    })

    test(`EN toggle flips ${cc} chrome to English`, async ({ page }) => {
      test.skip(!(await gotoCountry(page, cc)), `no region for ${cc} here`)
      const official = countryLocale(cc)
      // English-default or dictionary-less countries already serve
      // English and render no toggle — the fallback path itself.
      test.skip(
        official === "en" || !(official in DICTS),
        `${cc} resolves to English (no toggle)`
      )
      const toggle = page.locator("li.nav-locale a").first()
      await expect(toggle).toBeVisible()
      await toggle.click()
      await page.locator('a[href="#search"]').first().click()
      await expect(page.locator("#search.show")).toBeVisible()
      await expect(modalTitle(page)).toHaveText(en.search.modalTitle)
      await page.keyboard.press("Escape")
      // Back to official: clear the cookie, chrome follows.
      await page.context().clearCookies({ name: "lollies-locale" })
      await page.reload()
      await dismissPopups(page)
      await page.locator('a[href="#search"]').first().click()
      await expect(page.locator("#search.show")).toBeVisible()
      await expect(modalTitle(page)).toHaveText(
        DICTS[official].search.modalTitle
      )
    })
  })
}
