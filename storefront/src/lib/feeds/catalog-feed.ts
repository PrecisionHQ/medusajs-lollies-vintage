import { getProductsList } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getBaseURL, getStoreName } from "@lib/util/env"
import { stripHtmlToText } from "@lib/util/sanitize-html"

/**
 * Shared catalog feed (extracted from the Google route, Phase 3 C2).
 *
 * One row per variant (item_group_id = product id), region-priced in the
 * default market (gb). Google RSS format, which Meta ingests directly and
 * TikTok Business Center accepts as a scheduled-fetch template — so one
 * builder serves /feeds/google and /feeds/tiktok. No GTINs in the catalog,
 * so identifier_exists=no. Capped well above catalog size; crawlers refetch
 * on their own schedule.
 */

const esc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const variantLabel = (variant: any): string =>
  ((variant.options || []) as any[])
    .map((o) => o?.value)
    .filter(Boolean)
    .join(" / ");

export async function buildCatalogFeed(): Promise<Response> {
  const countryCode = "gb";
  const region = await getRegion(countryCode).catch(() => null);
  if (!region) {
    return new Response("region unavailable", { status: 503 });
  }

  const base = getBaseURL().replace(/\/$/, "");
  const brand = getStoreName();
  const currency = (
    (region as any).currency_code || "EUR"
  ).toUpperCase();

  const products: any[] = [];
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const { response } = await getProductsList({
      queryParams: { limit: 100, offset },
      countryCode,
    }).catch(() => ({ response: { products: [] as any[] } }));
    const batch = response.products || [];
    if (!batch.length) break;
    products.push(...batch);
    offset += batch.length;
    if (batch.length < 100) break;
  }

  const items: string[] = [];
  for (const p of products) {
    const link = `${base}/gb/products/${p.handle}`;
    const description = stripHtmlToText(p.description || "")
      .slice(0, 1000)
      .trim();
    for (const v of p.variants || []) {
      const calc = (v as any).calculated_price;
      // NOTE: calculated_amount is already in major units (the PDP renders
      // it undivided) — do NOT divide by 100 here.
      const amount =
        typeof calc?.calculated_amount === "number" ? calc.calculated_amount : null;
      if (amount == null) continue;
      const purchasable =
        !v.manage_inventory ||
        v.allow_backorder ||
        (v.inventory_quantity || 0) > 0;
      const label = variantLabel(v);
      items.push(
        [
          `<item>`,
          `<g:id>${esc(v.id)}</g:id>`,
          `<g:item_group_id>${esc(p.id)}</g:item_group_id>`,
          `<title>${esc(label ? `${p.title} - ${label}` : p.title)}</title>`,
          `<description>${esc(description || p.title)}</description>`,
          `<link>${esc(link)}</link>`,
          p.thumbnail ? `<g:image_link>${esc(p.thumbnail)}</g:image_link>` : "",
          `<g:brand>${esc(brand)}</g:brand>`,
          `<g:condition>new</g:condition>`,
          `<g:availability>${purchasable ? "in_stock" : "out_of_stock"}</g:availability>`,
          `<g:price>${Number(amount).toFixed(2)} ${currency}</g:price>`,
          `<g:identifier_exists>no</g:identifier_exists>`,
          `</item>`,
        ]
          .filter(Boolean)
          .join("")
      );
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">` +
    `<channel><title>${esc(brand)} products</title>` +
    `<link>${esc(base)}</link>` +
    `<description>${esc(`Product feed for ${brand}`)}</description>` +
    items.join("") +
    `</channel></rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
