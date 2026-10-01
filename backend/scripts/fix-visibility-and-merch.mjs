/**
 * One-off fixups (safe to re-run):
 *  1. Publish the draft members of the new-in collection (exactly the 4
 *     verified missing items — nothing else is touched).
 *  2. Merch move-then-delete: assign Shorts to a new `shorts` category
 *     (the other 3 tees already sit in shirts/pants/sweatshirts), then
 *     delete `merch` — refused unless every member keeps another category.
 *
 * NOTE: an earlier theory blamed missing sales channels, but the audit
 * proved it wrong (360 visible products have no channel; the gaps were 4
 * drafts + category membership). This script deliberately does NOT touch
 * sales channels.
 *
 * Usage:
 *   BACKEND_URL=... MEDUSA_ADMIN_EMAIL=... MEDUSA_ADMIN_PASSWORD=... \
 *   node fix-visibility-and-merch.mjs --dry-run
 *   ... --apply
 */

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "")
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL || ""
const PASS = process.env.MEDUSA_ADMIN_PASSWORD || ""
const APPLY = process.argv.includes("--apply")

if (!BACKEND_URL || !EMAIL || !PASS) {
  console.error("Set BACKEND_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD")
  process.exit(1)
}

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
  const { token } = await admin("/auth/user/emailpass", {
    method: "POST",
    body: { email: EMAIL, password: PASS },
  })
  console.log(`auth ok (mode: ${APPLY ? "APPLY" : "dry-run"})`)

  // Default sales channel
  const chans = await admin("/admin/sales-channels?limit=20", {}, token)
  const list = chans.sales_channels || []
  const def = list.find((c) => c.is_default) || list[0]
  if (!def) throw new Error("no sales channels found")
  console.log(`default channel: ${def.name || def.id} (${def.id})`)

  // 1. Draft members of new-in
  const newIn = await admin("/admin/collections?handle=new-in&limit=5", {}, token)
  const newInCol = (newIn.collections || [])[0]
  let drafts = []
  if (newInCol) {
    const mem = await admin(
      `/admin/products?collection_id=${newInCol.id}&limit=50&fields=id,title,handle,status`,
      {},
      token
    )
    drafts = (mem.products || []).filter((p) => p.status !== "published")
  }
  console.log(`new-in drafts to publish: ${drafts.map((p) => p.handle).join(", ") || "none"}`)

  // 2. Merch move-then-delete prep (no channel sweep: audit proved
  // channel-less products are store-visible; gaps were drafts only).
  const merchQ = await admin("/admin/product-categories?handle=merch&limit=5", {}, token)
  const merch = (merchQ.product_categories || [])[0]
  let merchMembers = []
  let shortsCat = null
  if (merch) {
    const m = await admin(
      `/admin/products?category_id=${merch.id}&limit=50&fields=id,title,handle,*categories`,
      {},
      token
    )
    merchMembers = m.products || []
    console.log(`merch members: ${merchMembers.map((p) => `${p.handle}[${(p.categories || []).map((c) => c.handle).join(",")}]`).join(" | ")}`)
    const shortsQ = await admin("/admin/product-categories?handle=shorts&limit=5", {}, token)
    shortsCat = (shortsQ.product_categories || [])[0] || null
    console.log(`shorts category: ${shortsCat ? shortsCat.id : "absent (will create)"}`)
  } else {
    console.log("merch category absent — nothing to do")
  }

  if (!APPLY) {
    console.log("\ndry-run complete — no writes.")
    return
  }

  for (const p of drafts) {
    await admin(`/admin/products/${p.id}`, { method: "POST", body: { status: "published" } }, token)
    console.log(`published ${p.handle}`)
  }

  if (merch) {
    if (!shortsCat) {
      const created = await admin(
        "/admin/product-categories",
        { method: "POST", body: { name: "Shorts", handle: "shorts", is_active: true } },
        token
      )
      shortsCat = created.product_category
      console.log(`created category shorts (${shortsCat.id})`)
    }
    for (const p of merchMembers) {
      const have = (p.categories || []).map((c) => c.id)
      if (p.handle === "shorts" && !have.includes(shortsCat.id)) {
        await admin(`/admin/products/${p.id}`, { method: "POST", body: { categories: [...have.map((id) => ({ id })), { id: shortsCat.id }] } }, token)
        console.log(`assigned shorts -> shorts category`)
      }
    }
    // Re-read: refuse unless every member keeps another category.
    const re = await admin(
      `/admin/products?category_id=${merch.id}&limit=50&fields=id,handle,*categories`,
      {},
      token
    )
    const orphans = (re.products || []).filter(
      (p) => (p.categories || []).filter((c) => c.id !== merch.id).length === 0
    )
    if (orphans.length) {
      console.log(`REFUSED to delete merch — would orphan: ${orphans.map((p) => p.handle).join(", ")}`)
    } else {
      await admin(`/admin/product-categories/${merch.id}`, { method: "DELETE" }, token)
      console.log(`deleted merch category (${merch.id})`)
    }
  }
  console.log("\napply complete.")
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})
