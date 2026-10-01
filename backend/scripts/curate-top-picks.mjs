/**
 * One-off: resolve the Shopify "Home page" (frontpage) collection order to
 * Medusa product IDs and write them as the homepage curated picks.
 *
 * Source: https://lolliesvintage.com/collections/frontpage (merchant-curated
 * homepage order — NOT alphabetical). Takes the first N matched titles in
 * frontpage order. Matching is by normalized title against store-visible
 * products only (same approach as import-shopify-collections.mjs).
 *
 * Output: <repo>/storefront/src/data/curated.json
 *   { "topPicks": ["prod_...", ...] }   // first 4 -> Top Picks, next 4 -> Trending
 *
 * Usage:
 *   BACKEND_URL=... PUBLISHABLE_KEY=pk_... \
 *   node curate-top-picks.mjs [--limit 8]
 * Re-run + redeploy whenever picks should refresh.
 */

import { writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "")
const PKEY = process.env.PUBLISHABLE_KEY || ""
const LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "8", 10)

if (!BACKEND_URL || !PKEY) {
  console.error("Set BACKEND_URL, PUBLISHABLE_KEY")
  process.exit(1)
}

const norm = (t) => (t || "").toLowerCase().replace(/\s+/g, " ").trim()
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, "..", "..", "storefront", "src", "data", "curated.json")

async function main() {
  // Store-visible products (id + title + handle)
  const storeIds = new Map() // normTitle -> [{id, handle}]
  let off = 0
  for (;;) {
    const d = await fetch(
      `${BACKEND_URL}/store/products?limit=100&offset=${off}&fields=id,title,handle`,
      { headers: { "x-publishable-api-key": PKEY } }
    ).then((r) => r.json())
    for (const p of d.products || []) {
      const k = norm(p.title)
      if (!storeIds.has(k)) storeIds.set(k, [])
      storeIds.get(k).push(p)
    }
    if ((d.products || []).length < 100) break
    off += 100
  }
  const total = [...storeIds.values()].reduce((a, v) => a + v.length, 0)
  console.log(`store-visible products: ${total}`)

  // Frontpage order (fetch extra to survive unmatched titles)
  const shop = await fetch(
    "https://lolliesvintage.com/collections/frontpage/products.json?limit=60"
  ).then((r) => r.json())
  const shopTitles = (shop.products || []).map((p) => p.title)
  console.log(`frontpage titles: ${shopTitles.length}`)

  const seen = new Set()
  const picks = []
  const unmatched = []
  for (const t of shopTitles) {
    if (picks.length >= LIMIT) break
    const hits = (storeIds.get(norm(t)) || []).filter((h) => !seen.has(h.id))
    if (!hits.length) {
      unmatched.push(t)
      continue
    }
    seen.add(hits[0].id)
    picks.push(hits[0])
  }

  console.log(`matched ${picks.length}/${LIMIT} (unmatched: ${unmatched.length})`)
  if (unmatched.length) console.log("  UNMATCHED:", unmatched.slice(0, 15).join(" | "))
  console.log("  picks:", picks.map((p) => `${p.title} [${p.handle}]`).join(" | "))

  if (picks.length < LIMIT) {
    console.error(`Only ${picks.length} picks — refusing to write short config.`)
    process.exit(1)
  }

  writeFileSync(OUT, JSON.stringify({ topPicks: picks.map((p) => p.id) }, null, 2) + "\n")
  console.log(`wrote ${OUT}`)
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})
