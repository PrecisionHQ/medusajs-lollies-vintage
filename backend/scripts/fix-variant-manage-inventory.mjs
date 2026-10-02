/**
 * One-off: un-brick purchasing on the production catalog.
 *
 * Root cause: 1770 of 1790 store-visible variants are
 * manage_inventory=true + allow_backorder=false + inventory_quantity=0.
 * The storefront gates option selection and add-to-cart on purchasability
 * (variantInStock), so every size/color button renders disabled and the
 * button sits on "Select options" forever — add-to-cart is dead across the
 * whole shop.
 *
 * Catalog-wide audit showed NO variant carries real tracked stock (the only
 * positive quantities are the 1,000,000 seed-merch markers). So turning off
 * inventory management for the zero-stock cohort restores buying without
 * fabricating stock numbers. If the merchant starts tracking stock later
 * they can flip manage_inventory back on and set real levels.
 *
 * Selection is surgical: only variants that are managed, not backorderable
 * and at zero stock are touched. Seeds (1M stock) and any positively
 * stocked variant keep their current settings.
 *
 * Usage (Admin + Store APIs over HTTP — no DB access needed):
 *   BACKEND_URL=https://backend-production-35a6.up.railway.app \
 *   MEDUSA_ADMIN_EMAIL=admin@... MEDUSA_ADMIN_PASSWORD=... \
 *   PUBLISHABLE_KEY=pk_... \
 *   node fix-variant-manage-inventory.mjs            # dry-run (default)
 *   node fix-variant-manage-inventory.mjs --apply    # write (idempotent —
 *                                                   # a rerun finds nothing)
 */

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "")
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL || ""
const PASS = process.env.MEDUSA_ADMIN_PASSWORD || ""
const PUBLISHABLE_KEY = process.env.PUBLISHABLE_KEY || ""
const APPLY = process.argv.includes("--apply")

if (!BACKEND_URL || !EMAIL || !PASS || !PUBLISHABLE_KEY) {
  console.error(
    "Set BACKEND_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD, PUBLISHABLE_KEY"
  )
  process.exit(1)
}

const storeHeaders = { "x-publishable-api-key": PUBLISHABLE_KEY }

async function admin(path, { method = "GET", body } = {}, token) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function main() {
  // 1. Store-visible catalog with the purchasability flags (this is what
  //    the storefront bases its gating on).
  const targets = []
  let offset = 0
  for (;;) {
    const qs = new URLSearchParams({
      limit: "100",
      offset: String(offset),
      fields:
        "+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder",
    })
    const res = await fetch(`${BACKEND_URL}/store/products?${qs}`, {
      headers: storeHeaders,
    })
    if (!res.ok) throw new Error(`store products -> ${res.status}`)
    const { products } = await res.json()
    if (!products?.length) break
    for (const p of products) {
      for (const v of p.variants || []) {
        if (
          v.manage_inventory &&
          !v.allow_backorder &&
          (v.inventory_quantity || 0) === 0
        ) {
          targets.push({
            productId: p.id,
            title: p.title,
            variantId: v.id,
          })
        }
      }
    }
    offset += 100
  }
  console.log(
    `zero-stock managed variants to flip: ${targets.length}${
      APPLY ? "" : " (dry-run — pass --apply to write)"
    }`
  )
  if (!targets.length) return

  // 2. Admin auth.
  const { token } = await admin("/auth/user/emailpass", {
    method: "POST",
    body: { email: EMAIL, password: PASS },
  })
  if (!token) throw new Error("admin login returned no token")

  // 3. Flip manage_inventory=false (idempotent).
  let ok = 0,
    fail = 0,
    consecutiveFails = 0
  const CONCURRENCY = 8
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (t) => {
        if (!APPLY) return { t, skipped: true }
        try {
          await admin(
            `/admin/products/${t.productId}/variants/${t.variantId}`,
            { method: "POST", body: { manage_inventory: false } },
            token
          )
          return { t, skipped: false }
        } catch (e) {
          return { t, skipped: false, error: e.message }
        }
      })
    )
    for (const r of results) {
      if (r.skipped || !r.error) {
        ok++
        consecutiveFails = 0
        if (APPLY && ok % 100 === 0) console.log(`  ...${ok}/${targets.length}`)
      } else {
        fail++
        consecutiveFails++
        console.error(`  FAIL ${r.t.title} ${r.t.variantId}: ${r.error}`)
        if (consecutiveFails >= 5) {
          throw new Error(
            "aborting: 5 consecutive failures (wrong endpoint/shape?)"
          )
        }
      }
    }
  }
  console.log(
    APPLY
      ? `done: ${ok} flipped, ${fail} failed`
      : `dry-run: ${ok} would flip, ${fail} errors (none written)`
  )
  if (fail && APPLY) process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
