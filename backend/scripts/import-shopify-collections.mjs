/**
 * One-off: build merchandising collections in production from Shopify lists.
 *
 * Source of truth for membership:
 *   bridal -> https://lolliesvintage.com/collections/bridal
 *   sale   -> https://lolliesvintage.com/collections/sale-upto-50-off
 *   new-in -> 12 newest products by created_at (+ curated later in Admin)
 *
 * Matching is by normalized title (Shopify handle scheme differs from the
 * Medusa one). Duplication allowed: EVERY title hit goes in, not just the
 * first. Hits invisible on the storefront are skipped.
 * Trending = 12 random live products excluding bridal/new-in members
 * (one collection per product — no stealing).
 *
 * Usage (Admin API over HTTP — no DB access needed):
 *   BACKEND_URL=https://backend-production-35a6.up.railway.app \
 *   MEDUSA_ADMIN_EMAIL=admin@... MEDUSA_ADMIN_PASSWORD=... \
 *   node import-shopify-collections.mjs --dry-run
 *   ... --apply   # creates collections + assigns products (idempotent-ish:
 *                 # existing handles are reused, members added, never removed)
 */

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "")
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL || ""
const PASS = process.env.MEDUSA_ADMIN_PASSWORD || ""
const APPLY = process.argv.includes("--apply")

if (!BACKEND_URL || !EMAIL || !PASS) {
  console.error("Set BACKEND_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD")
  process.exit(1)
}

const SHOPIFY = "https://lolliesvintage.com"
const CATS_MODE = process.argv.includes("--cats")
// NOTE: a Medusa product holds exactly ONE collection_id, but Shopify lists
// overlap (e.g. DENISE DRESS is in both Bridal and Sale). Last-writer-wins
// silently steals shared members, so the overlapping dimension (Sale) is a
// product CATEGORY instead (many-to-many — overlaps freely). Menu/tiles link
// it via /categories/sale; Bridal + New In stay collections.
const WANT = [
  { key: "bridal", kind: "collection", title: "Bridal", handle: "bridal", shopPath: "/collections/bridal/products.json?limit=250" },
  { key: "sale", kind: "category", title: "Sale", handle: "sale", shopPath: "/collections/sale-upto-50-off/products.json?limit=250" },
]

// Name-rule categories (garment types parsed from product titles).
// Categories are many-to-many: overlaps (SATIN MAXI DRESS in three places)
// are free, unlike collections.
const RULES = [
  { key: "dresses", title: "Dresses", handle: "dresses", words: ["DRESS", "MINI", "MIDI"] },
  { key: "maxi", title: "Maxi Dresses", handle: "maxi-dresses", words: ["MAXI"] },
  { key: "mini-midi", title: "Mini & Midi Dresses", handle: "mini-midi-dresses", words: ["MINI", "MIDI"] },
  { key: "satin", title: "Satin Dresses", handle: "satin-dresses", words: ["SATIN"] },
  { key: "curve", title: "Curve", handle: "curve", words: ["CURVE"] },
  { key: "jumpsuits", title: "Jumpsuits & Playsuits", handle: "jumpsuits-playsuits", words: ["JUMPSUIT", "PLAYSUIT", "BODYSUIT", "TWO-PIECE"] },
  { key: "sets", title: "Co-ord Sets", handle: "coord-sets", words: ["SET"] },
  { key: "skirts", title: "Skirts", handle: "skirts", words: ["SKIRT"] },
  { key: "tops", title: "Tops & Jackets", handle: "tops-jackets", words: ["TOP", "JACKET"] },
  { key: "signature", title: "Signature Edit", handle: "signature-edit", exact: ["MILANA", "REENA NAVY", "LAVISH ALICE", "ARIANN SHEER", "STEPHANIE PRATT"] },
  { key: "merch", title: "Merch", handle: "merch", exact: ["Medusa T-Shirt", "Medusa Shorts", "Medusa Sweatpants", "Medusa Sweatshirt"] },
]

// Seed categories to remove once verified empty (wrong names for this shop).
const DOOMED_HANDLES = ["shirts", "pants", "sweatshirts"]

const norm = (t) => (t || "").toLowerCase().replace(/\s+/g, " ").trim()

const wordHit = (title, word) =>
  new RegExp(`(?<![A-Z])${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?![A-Z])`).test(
    (title || "").toUpperCase()
  )

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
    const text = await res.text()
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function main() {
  // 1. Auth
  const { token } = await admin("/auth/user/emailpass", {
    method: "POST",
    body: { email: EMAIL, password: PASS },
  })
  console.log(`auth ok (mode: ${APPLY ? "APPLY" : "dry-run"})`)

  // 2. All admin products (sees drafts too — we only match published-by-title)
  let products = []
  let offset = 0
  for (;;) {
    const d = await admin(
      `/admin/products?limit=100&offset=${offset}&fields=id,title,handle,created_at,status`,
      {},
      token
    )
    products.push(...(d.products || []))
    if ((d.products || []).length < 100) break
    offset += 100
  }
  console.log(`admin products: ${products.length}`)
  const byTitle = new Map()
  for (const p of products) {
    const k = norm(p.title)
    if (!byTitle.has(k)) byTitle.set(k, [])
    byTitle.get(k).push(p)
  }

  // 2b. Store-visible ids (admin sees drafts too — collection members must
  // be buyable, so prefer hits that the Store API returns).
  const PKEY = process.env.PUBLISHABLE_KEY || ""
  const storeIds = new Set()
  if (PKEY) {
    let off = 0
    for (;;) {
      const d = await fetch(
        `${BACKEND_URL}/store/products?limit=100&offset=${off}&fields=id`,
        { headers: { "x-publishable-api-key": PKEY } }
      ).then((r) => r.json())
      for (const p of d.products || []) storeIds.add(p.id)
      if ((d.products || []).length < 100) break
      off += 100
    }
    console.log(`store-visible products: ${storeIds.size}`)
  } else {
    console.log("PUBLISHABLE_KEY unset — skipping store-visibility filter")
  }
  // 3. Shopify lists: include EVERY title hit (duplication allowed — e.g.
  // all 21 DENISE DRESS dupes go in, not just the first). Hits invisible on
  // the storefront (drafts/offline) are skipped and reported.
  const plan = []
  for (const w of WANT) {
    const d = await fetch(`${SHOPIFY}${w.shopPath}`).then((r) => r.json())
    const shopTitles = (d.products || []).map((p) => p.title)
    const matched = []
    const missing = []
    const dupes = []
    const offline = []
    for (const t of shopTitles) {
      const hits = byTitle.get(norm(t)) || []
      if (!hits.length) missing.push(t)
      else {
        if (hits.length > 1) dupes.push(`${t} (${hits.length}x dupes)`)
        const live = storeIds.size
          ? hits.filter((h) => storeIds.has(h.id))
          : hits
        if (!live.length) offline.push(`${t} (all ${hits.length} dupes offline)`)
        matched.push(...live)
      }
    }
    plan.push({ ...w, matched, missing, dupes, offline, shopCount: shopTitles.length })
  }

  // 4. New-in: newest by created_at
  const newest = [...products]
    .filter((p) => p.created_at)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 12)
  plan.push({
    key: "new-in",
    kind: "collection",
    title: "New In",
    handle: "new-in",
    matched: newest,
    missing: [],
    dupes: [],
    offline: [],
    shopCount: null,
  })

  // 4b. Trending: 12 random store-visible products. A Medusa product holds
  // exactly ONE collection, so bridal/new-in members are excluded from the
  // pool — otherwise trending would steal them. (Sale is a category, so
  // overlap with sale is harmless.)
  const reserved = new Set(
    plan.flatMap((c) => c.matched.map((m) => m.id))
  )
  const pool = products.filter(
    (p) => storeIds.has(p.id) && !reserved.has(p.id) && p.status === "published"
  )
  const trending = []
  const poolCopy = [...pool]
  while (trending.length < 12 && poolCopy.length) {
    const i = Math.floor(Math.random() * poolCopy.length)
    trending.push(poolCopy.splice(i, 1)[0])
  }
  plan.push({
    key: "trending",
    kind: "collection",
    title: "Trending",
    handle: "trending",
    matched: trending,
    missing: [],
    dupes: [],
    offline: [],
    shopCount: null,
  })

  // 4c. Name-rule categories (--cats): discard the Shopify plan above and
  // build category membership from title rules instead.
  let doomed = []
  if (CATS_MODE) {
    if (!storeIds.size) {
      console.error("PUBLISHABLE_KEY is required in --cats mode (store-visibility filter).")
      process.exit(1)
    }
    plan.length = 0
    for (const r of RULES) {
      const matched = []
      if (r.exact) {
        const wanted = new Set(r.exact.map(norm))
        for (const p of products) {
          if (wanted.has(norm(p.title)) && storeIds.has(p.id)) matched.push(p)
        }
      } else {
        for (const p of products) {
          if (r.words.some((w) => wordHit(p.title, w)) && storeIds.has(p.id)) matched.push(p)
        }
      }
      plan.push({
        key: r.key, kind: "category", title: r.title, handle: r.handle,
        matched, missing: [], dupes: [], offline: [], shopCount: null,
      })
    }
    // Seed categories to delete — only when verified empty.
    for (const h of DOOMED_HANDLES) {
      const found = await admin(
        `/admin/product-categories?handle=${encodeURIComponent(h)}&limit=5`,
        {},
        token
      )
      const cat = (found.product_categories || [])[0]
      if (!cat) {
        doomed.push({ handle: h, status: "absent" })
        continue
      }
      const members = await admin(
        `/admin/products?category_id=${cat.id}&limit=1&fields=id`,
        {},
        token
      )
      doomed.push({ handle: h, id: cat.id, members: members.count ?? 0 })
    }
  }

  // 5. Dry-run report
  for (const c of plan) {
    console.log(`\n== ${c.key} [${c.kind}]: shopify=${c.shopCount ?? "n/a"} matched=${c.matched.length} missing=${c.missing.length} dupes=${c.dupes.length} offline=${c.offline.length}`)
    if (c.missing.length) console.log("  MISSING:", c.missing.slice(0, 20).join(" | "))
    if (c.dupes.length) console.log("  DUPES (store-visible pick used):", c.dupes.slice(0, 10).join(" | "))
    if (c.offline.length) console.log("  OFFLINE:", c.offline.slice(0, 10).join(" | "))
    console.log("  sample:", c.matched.slice(0, 5).map((m) => m.handle).join(", "))
  }
  if (doomed.length) {
    console.log("\nseed-category cleanup preview:")
    for (const d of doomed) console.log(`  ${d.handle}: ${d.status ?? `${d.members} members`}`)
  }

  if (!APPLY) {
    console.log("\ndry-run complete — no writes. Re-run with --apply to create + assign.")
    return
  }

  // 6. Apply: create (or reuse) collections/categories, add members.
  // Order matters: categories first (no exclusivity), then collections, so a
  // shared product ends up in its collection AND the sale category.
  const byKind = [...plan].sort((a, b) =>
    (a.kind === "category" ? 0 : 1) - (b.kind === "category" ? 0 : 1)
  )
  for (const c of byKind) {
    if (c.kind === "category") {
      const existing = await admin(
        `/admin/product-categories?handle=${encodeURIComponent(c.handle)}&limit=5`,
        {},
        token
      )
      let cat = (existing.product_categories || [])[0]
      if (!cat) {
        const created = await admin(
          "/admin/product-categories",
          { method: "POST", body: { name: c.title, handle: c.handle, is_active: true } },
          token
        )
        cat = created.product_category
        console.log(`created category ${c.handle} (${cat.id})`)
      } else {
        console.log(`reusing category ${c.handle} (${cat.id})`)
      }
      const ids = [...new Set(c.matched.map((m) => m.id))]
      if (ids.length) {
        try {
          await admin(`/admin/product-categories/${cat.id}/products`, { method: "POST", body: { add: ids } }, token)
        } catch (e) {
          if (!e.message.includes(" 404")) throw e
          console.log("  batch endpoint missing — assigning per product")
          for (const id of ids) {
            const cur = await admin(`/admin/products/${id}?fields=id,*categories`, {}, token)
            const have = (cur.product?.categories || []).map((x) => ({ id: x.id }))
            if (!have.some((x) => x.id === cat.id)) {
              await admin(`/admin/products/${id}`, { method: "POST", body: { categories: [...have, { id: cat.id }] } }, token)
            }
          }
        }
      }
      console.log(`  category ${c.handle}: +${ids.length} products`)
      continue
    }
    const existing = await admin(
      `/admin/collections?handle=${encodeURIComponent(c.handle)}&limit=5`,
      {},
      token
    )
    let col = (existing.collections || [])[0]
    if (!col) {
      const created = await admin("/admin/collections", { method: "POST", body: { title: c.title, handle: c.handle } }, token)
      col = created.collection
      console.log(`created collection ${c.handle} (${col.id})`)
    } else {
      console.log(`reusing collection ${c.handle} (${col.id})`)
    }
    const ids = [...new Set(c.matched.map((m) => m.id))]
    if (ids.length) {
      await admin(`/admin/collections/${col.id}/products`, { method: "POST", body: { add: ids } }, token)
    }
    console.log(`  ${c.handle}: +${ids.length} products`)
  }

  // 7. Cleanup: the first attempt created sale-up-to-50-off as a COLLECTION,
  // which cannot overlap with bridal. Sale now lives as a category — remove
  // the stale collection so its members (shared with bridal) stay put.
  const stale = await admin("/admin/collections?handle=sale-up-to-50-off&limit=5", {}, token)
  for (const s of stale.collections || []) {
    await admin(`/admin/collections/${s.id}`, { method: "DELETE" }, token)
    console.log(`deleted stale collection ${s.handle} (${s.id})`)
  }

  // 8. Seed-category cleanup (--cats only): delete verified-empty seeds.
  // Refuses to touch any category that still has members.
  for (const d of doomed) {
    if (d.status === "absent") continue
    if ((d.members ?? 0) > 0) {
      console.log(`REFUSED to delete ${d.handle}: still has ${d.members} members`)
      continue
    }
    await admin(`/admin/product-categories/${d.id}`, { method: "DELETE" }, token)
    console.log(`deleted empty seed category ${d.handle} (${d.id})`)
  }
  console.log("\napply complete.")
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})
