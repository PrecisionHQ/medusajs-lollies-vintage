import { expect, Page } from "@playwright/test"
import { qaEnv } from "./env"

/** Every storefront route is prefixed with a country code. */
export const url = (path = ""): string => {
  const suffix = path.replace(/^\//, "")
  return suffix ? `/${qaEnv.region}/${suffix}` : `/${qaEnv.region}`
}

/**
 * Accounts cannot be deleted from the storefront, so each run registers a
 * fresh address instead of reusing one. Keeping the run id in the local part
 * makes leftovers from a QA run easy to spot in the admin.
 */
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
let sequence = 0

export const uniqueEmail = (prefix = "qa"): string =>
  `${prefix}-${runId}-${sequence++}@example.com`

export type TestCustomer = {
  firstName: string
  lastName: string
  email: string
  password: string
}

export const newCustomer = (prefix = "qa"): TestCustomer => ({
  firstName: "Quinn",
  lastName: "Tester",
  email: uniqueEmail(prefix),
  password: "supersecret",
})

/**
 * Signed-in check that works at any viewport. The account overview body is
 * entirely `hidden small:block`, so on a phone nothing of it renders and the
 * welcome message cannot be waited on. AccountNav is only rendered when a
 * customer is resolved, so the login form being gone is the reliable signal.
 */
export const assertSignedIn = async (page: Page) => {
  await expect(page.getByTestId("login-page")).toHaveCount(0)

  // AccountNav renders only once a customer has actually been resolved, and
  // it emits both navs at every width with CSS deciding which one shows. So
  // "attached" is the viewport-independent proof that we are signed in, and
  // unlike the layout wrapper it is not also present on the login view.
  await expect(page.getByTestId("mobile-account-nav")).toBeAttached()
}

/** Registers a customer through the UI and lands on the account dashboard. */
export const register = async (page: Page, customer: TestCustomer) => {
  await page.goto(url("account"))
  await page.getByTestId("register-button").click()
  await expect(page.getByTestId("register-page")).toBeVisible()

  await page.getByTestId("first-name-input").fill(customer.firstName)
  await page.getByTestId("last-name-input").fill(customer.lastName)
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("register-button").click()

  await assertSignedIn(page)
}

export const login = async (page: Page, customer: TestCustomer) => {
  await page.goto(url("account"))
  await expect(page.getByTestId("login-page")).toBeVisible()
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("sign-in-button").click()
  await assertSignedIn(page)
}

/**
 * Picks the first choice in every option group, which is enough to resolve a
 * variant on all four seeded products.
 */
export const selectFirstVariant = async (page: Page) => {
  // The mobile action bar is position-fixed and can sit over the options.
  await page.mouse.move(0, 0)

  // The mobile sheet renders the same option groups with the same testid, and
  // whether it is mounted depends on scroll position and build mode. Only the
  // groups actually on screen belong to the in-page selector.
  const groups = page.getByTestId("product-options")
  const count = await groups.count()
  for (let i = 0; i < count; i++) {
    const group = groups.nth(i)
    if (await group.isVisible()) {
      await group.getByTestId("option-button").first().click()
    }
  }
}

/** Opens a product by handle, resolves a variant and adds one to the cart. */
export const addProductToCart = async (page: Page, handle: string) => {
  await page.goto(url(`products/${handle}`))
  await expect(page.getByTestId("product-container")).toBeVisible()

  const countBefore = await cartCount(page)

  await selectFirstVariant(page)

  const addButton = page.getByTestId("add-product-button").first()
  await expect(addButton).toBeEnabled()
  await addButton.click()

  // The nav count is the deterministic signal. The dropdown auto-opens only
  // when totalItems differs from a useRef captured at mount, so if the
  // component remounts with the new count already in place it never opens.
  // That happens in production builds but rarely in dev, so asserting on the
  // dropdown here made most of the suite fail against `next start`.
  await expectCartCount(page, countBefore + 1, `adding ${handle}`)
}

/**
 * Waits for the nav cart count, reloading once if it does not repaint.
 *
 * Roughly one add in fifteen never repaints the nav in a production build.
 * Measured, not guessed: on every stuck run the line item IS on the cart in
 * Medusa, the server returns the correct count when the same page is requested
 * with that cart cookie, and a reload recovers it within 250ms. The write
 * lands; the render lags.
 *
 * So this reloads rather than failing. The tests that merely need a populated
 * cart should not go red over a rendering defect, and that defect is held open
 * by its own test, "the cart count repaints without a reload" in
 * qa/04-cart.spec.ts, which carries the full evidence.
 */
export const expectCartCount = async (
  page: Page,
  expected: number,
  context: string
) => expectAfterCartWrite(page, () => cartCount(page), expected, context)

/**
 * Polls for a value the page should show after a cart write, reloading once if
 * it does not appear.
 *
 * Every cart mutation is affected, not just adding: quantity changes and line
 * removals go stale the same way and at the same rate. Count the
 * "did not repaint" warnings in a run to measure it. When the scoped cache tags
 * land, that count should go to zero, which is a far better instrument than one
 * randomly red test per run.
 */
export const expectAfterCartWrite = async <T>(
  page: Page,
  read: () => Promise<T>,
  expected: T,
  context: string
) => {
  try {
    await expect.poll(read, { timeout: 15_000 }).toEqual(expected)
  } catch {
    console.warn(
      `[qa] page did not repaint after ${context}; reloading. ` +
        `See "the cart count repaints without a reload" in qa/04-cart.spec.ts.`
    )
    await page.reload()
    await expect.poll(read, { timeout: 15_000 }).toEqual(expected)
  }
}

/** Reads the item count out of the nav cart link, e.g. "Cart (2)" -> 2. */
export const cartCount = async (page: Page): Promise<number> => {
  const text = await page.getByTestId("nav-cart-link").first().textContent()
  const match = text?.match(/\((\d+)\)/)
  return match ? Number(match[1]) : 0
}

/** Reads a money string like "£19.50" into 19.5 so totals can be compared. */
export const parseMoney = (value: string | null): number => {
  if (!value) {
    return NaN
  }
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "")
  return Number.parseFloat(cleaned)
}

/**
 * Suppress the newsletter auto-popup for the whole test. The modal checks
 * its subscribed flag synchronously at mount, so the flag must be present
 * BEFORE page scripts run — post-load evaluate() always loses that race.
 * Call once before the first goto(); it persists across navigations.
 */
export const suppressPopups = async (page: Page) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("lollies_newsletter_subscribed", "1")
    } catch {
      // Private mode: the popup shows; dismissPopups closes it.
    }
  })
}

/**
 * Close the newsletter modal if it opened (unsuppressed contexts,
 * mid-test reloads that predate suppression). Belt-and-braces next to
 * suppressPopups, not a replacement.
 */
export const dismissPopups = async (page: Page) => {
  const popup = page.locator("#newsletterPopup.show")
  if (await popup.isVisible({ timeout: 3000 }).catch(() => false)) {
    await popup.locator(".icon-close").first().click({ force: true })
    await expect(popup).toBeHidden({ timeout: 5000 })
  }
}

/**
 * Opens the first product's QuickView by hovering its card and clicking
 * the card's OWN trigger. Scoped per card on purpose: every card renders
 * two quickview triggers (hover icon + main button) and carousel cards
 * can match a global `:visible` while sitting off-screen, so a global
 * first-match click sometimes lands on nothing and the modal never
 * opens — flaky only under load, which is exactly when QA matters.
 */
export const openFirstQuickView = async (page: Page) => {
  const cards = page.locator(".card-product")
  const count = await cards.count()
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i)
    if (!(await card.isVisible().catch(() => false))) {
      continue
    }
    await card.hover().catch(() => {})
    const trigger = card.locator('a[href="#quickView"]').first()
    if (!(await trigger.isVisible().catch(() => false))) {
      continue
    }
    await trigger.click({ force: true, timeout: 5000 }).catch(() => {})
    if (
      await page
        .locator("#quickView.show")
        .waitFor({ state: "attached", timeout: 2000 })
        .then(() => true)
        .catch(() => false)
    ) {
      return
    }
  }
  await expect(page.locator("#quickView.show")).toBeVisible({ timeout: 10000 })
}

/**
 * Clicks a Bootstrap overlay trigger until its target opens. The bundle
 * loads async after first paint, so a fast click can land before
 * data-bs-toggle is live and do nothing — retry instead of failing.
 *
 * Live QA showed two distinct traps: a click that opens the modal under
 * the cursor times out on post-click stability while the fade animation
 * covers the trigger, and the NEXT retry click is then intercepted by
 * the open modal. So: each retry first closes any overlay left open,
 * and success is decided by the target's `.show` class being attached
 * (Bootstrap adds it synchronously on show()), never by visibility —
 * the fade delays computed visibility while the page is already
 * blocked, which is what turned a pass into a 30s timeout.
 */
export const openOverlay = async (
  page: Page,
  trigger: string,
  target: string
) => {
  const targetLocator = page.locator(target)
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await page.locator(".modal.show, .offcanvas.show").count()) > 0) {
      await page.keyboard.press("Escape").catch(() => {})
      await page
        .locator(".modal.show .icon-close, .offcanvas.show .icon-close")
        .first()
        .click({ force: true, timeout: 3000 })
        .catch(() => {})
      await page
        .locator(".modal.show, .offcanvas.show")
        .first()
        .waitFor({ state: "detached", timeout: 3000 })
        .catch(() => {})
    }
    await page
      .locator(trigger)
      .first()
      .click({ timeout: 8000 })
      .catch(() => {})
    if (
      await targetLocator
        .first()
        .waitFor({ state: "attached", timeout: 1500 })
        .then(() => true)
        .catch(() => false)
    ) {
      return
    }
  }
  await expect(targetLocator).toBeVisible({ timeout: 5000 })
}

export { qaEnv }
