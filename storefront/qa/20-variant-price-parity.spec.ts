import { test, expect } from "@playwright/test"
import fs from "fs"
import path from "path"
import { dismissPopups, qaEnv, url } from "./helpers"
import { convertToLocale } from "../src/lib/util/money"

/**
 * Variant pricing end-to-end (#4, #8). The PDP must show the EXACT backend
 * calculated price for the selected variant — never another variant's
 * price — and a "From" cheapest price while nothing is selected.
 *
 * Reads the catalogue through the public store API (same publishable key
 * the storefront itself uses), drives the real PDP option pickers, and
 * compares the rendered price against the API's calculated_amount for the
 * resolved variant. Needs a live stack; asserts nothing about seed data
 * beyond requiring one multi-variant priced product (skips otherwise).
 */

const readPublishableKey = (): string => {
  if (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  }
  const file = path.resolve(__dirname, "..", ".env.local")
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
      const m = line.trim().match(/^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=(.*)$/)
      if (m) return m[1].trim().replace(/^["']|["']$/g, "")
    }
  }
  return ""
}

type ApiVariant = {
  id: string
  options?: { option?: { title?: string }; value?: string | null }[]
  calculated_price?: {
    calculated_amount?: number | null
    currency_code?: string
  } | null
}

const variantKeymap = (v: ApiVariant): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const o of v.options || []) {
    if (o?.option?.title && o.value != null) out[o.option.title] = o.value
  }
  return out
}

test.describe("Variant price parity", () => {
  test("PDP shows the backend price for the selected variant", async ({
    page,
    request,
  }) => {
    const pk = readPublishableKey()
    test.skip(!pk, "no publishable key available")

    const headers = { "x-publishable-api-key": pk }
    const regionsRes = await request.get(`${qaEnv.backendURL}/store/regions`, {
      headers,
    })
    test.skip(!regionsRes.ok(), "regions API unreachable")
    const { regions } = await regionsRes.json()
    const region = (regions || []).find((r: any) =>
      (r.countries || []).some(
        (c: any) => (c.iso_2 || "").toLowerCase() === qaEnv.region
      )
    )
    test.skip(!region, `no region covers ${qaEnv.region}`)

    const prodRes = await request.get(
      `${qaEnv.backendURL}/store/products?limit=50&region_id=${region.id}`,
      { headers }
    )
    test.skip(!prodRes.ok(), "products API unreachable")
    const { products } = await prodRes.json()
    const candidate = (products || []).find(
      (p: any) =>
        p.handle &&
        (p.variants || []).filter(
          (v: ApiVariant) => v.calculated_price?.calculated_amount != null
        ).length > 1
    )
    test.skip(
      !candidate,
      "catalogue has no multi-variant priced product to verify"
    )

    const priced = candidate.variants.filter(
      (v: ApiVariant) => v.calculated_price?.calculated_amount != null
    )
    const optionTitles = [
      ...new Set(
        priced.flatMap((v: ApiVariant) => Object.keys(variantKeymap(v)))
      ),
    ]
    test.skip(optionTitles.length === 0, "variants carry no options")

    await page.goto(url(`products/${candidate.handle}`))
    await dismissPopups(page)

    // Nothing selected yet: honest "From <cheapest>" state, never a
    // variant price masquerading as the price.
    const cheapest = [...priced].sort(
      (a: ApiVariant, b: ApiVariant) =>
        (a.calculated_price?.calculated_amount ?? 0) -
        (b.calculated_price?.calculated_amount ?? 0)
    )[0]
    await expect(page.locator(".price-from-label").first()).toBeVisible()
    await expect(page.locator(".tf-product-info-price").first()).toContainText(
      convertToLocale({
        amount: cheapest.calculated_price!.calculated_amount!,
        currency_code: cheapest.calculated_price!.currency_code!,
      })
    )

    // Drive the pickers to an exact variant and expect its exact price.
    // Picker input ids embed the Medusa option id (pdp-<optionId>-<value>),
    // which maps back to the option title via the API product.
    const target = priced[priced.length - 1]
    const targetMap = variantKeymap(target)
    const idToTitle: Record<string, string> = {}
    for (const opt of candidate.options || []) {
      if (opt?.id && opt?.title) idToTitle[opt.id] = opt.title
    }
    const groups = page.locator(".variant-picker-item")
    const optionIds = Object.keys(idToTitle)
    for (let i = 0; i < (await groups.count()); i++) {
      const group = groups.nth(i)
      const inputId =
        (await group.locator("input[id]").first().getAttribute("id")) || ""
      // Input ids are pdp-<optionId>-<value>; option ids never contain
      // dashes but values may, so match known ids as prefixes.
      const optionId = optionIds.find((id) =>
        inputId.startsWith(`pdp-${id}-`)
      )
      const title = optionId ? idToTitle[optionId] : undefined
      const want = title ? targetMap[title] : undefined
      if (!want) continue
      await group.locator(`[data-value="${want}"]`).first().click()
    }

    const expected = convertToLocale({
      amount: target.calculated_price!.calculated_amount!,
      currency_code: target.calculated_price!.currency_code!,
    })
    const priceBox = page.locator(".tf-product-info-price").first()
    await expect(priceBox).toContainText(expected)
    await expect(page.locator(".price-from-label")).toHaveCount(0)
  })
})
