import { Modules } from "@medusajs/framework/utils";
import { EmailTemplates } from "../email-notifications/templates";
import {
  BACKEND_URL,
  RESEND_FROM_EMAIL,
  STOREFRONT_URL,
} from "../../lib/constants";
import { buildUnsubscribeLink } from "./utils";
import {
  alreadySent,
  claimSend,
  isOptedOut,
} from "./flow-guards";

export type PricedProduct = {
  id: string;
  title: string;
  handle: string;
  thumbnail?: string | null;
  /** Lowest dropped price found (minor units, as the API returns). */
  dropMin: number | null;
};

/**
 * P9 — Wishlist price-drop alerts.
 *
 * A drop = any variant whose calculated price is below its original
 * amount, exactly as shoppers see it. Catalog rows carry no compare-at
 * data, so "current" comes from our own store API with a region context
 * (batched list call — the detail route is unreliable for this; the
 * list route is what the storefront itself uses). Idempotency key
 * carries the new lowest amount, so further drops re-alert naturally.
 * One grouped mail per shopper, no frequency cap (alerts are the
 * point); opt-outs respected.
 */
export async function runPriceDrop(
  container: any
): Promise<{ sent: number; skipped: number }> {
  const marketing = container.resolve("marketing") as any;
  const notifications = container.resolve(Modules.NOTIFICATION);
  const wishlist = container.resolve("wishlist") as any;
  const customerModule = container.resolve(Modules.CUSTOMER);
  const regionModule = container.resolve(Modules.REGION);
  const base = STOREFRONT_URL.replace(/\/$/, "");
  const api = BACKEND_URL.replace(/\/$/, "");

  const apiKey = await getPublishableKey(container);
  const regionId = apiKey ? await getDefaultRegionId(regionModule) : null;
  if (!apiKey || !regionId) {
    return { sent: 0, skipped: 0 };
  }

  let sent = 0,
    skipped = 0,
    offset = 0;
  for (;;) {
    const lists = await wishlist
      .listWishlists({}, { take: 100, skip: offset })
      .catch(() => []);
    if (!lists?.length) break;
    offset += lists.length;

    for (const list of lists) {
      try {
        const customer = list.customer_id
          ? await customerModule
              .retrieveCustomer(list.customer_id)
              .catch(() => null)
          : null;
        const email = (customer?.email || "").trim().toLowerCase();
        if (!email || (await isOptedOut(marketing, email))) {
          skipped += 1;
          continue;
        }

        const items = await wishlist
          .listWishlistItems({ wishlist_id: list.id })
          .catch(() => []);
        const productIds = [
          ...new Set(
            (items || []).map((i: any) => i.product_id).filter(Boolean)
          ),
        ] as string[];
        if (!productIds.length) {
          skipped += 1;
          continue;
        }

        const priced = await fetchPricedProducts(
          productIds,
          regionId,
          apiKey,
          api
        );
        const dropped: {
          title: string;
          image: string | null;
          link: string;
        }[] = [];
        for (const p of priced) {
          if (p.dropMin == null) continue;
          if (await alreadySent(marketing, "pricedrop", `${p.id}:${p.dropMin}`)) {
            continue;
          }
          dropped.push({
            title: p.title,
            image: p.thumbnail ?? null,
            link: `${base}/products/${p.handle}`,
          });
          await claimSend(marketing, "pricedrop", `${p.id}:${p.dropMin}`, email);
        }
        if (!dropped.length) {
          skipped += 1;
          continue;
        }

        await notifications.createNotifications({
          to: email,
          channel: "email",
          template: EmailTemplates.CAMPAIGN,
          data: {
            emailOptions: {
              replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
              subject: "Price drop on your wishlist",
            },
            headline: "Price drop on your wishlist",
            body: "Something you saved just went on sale.",
            ctaLabel: "View wishlist",
            ctaHref: `${base}/account/wishlist`,
            products: dropped.slice(0, 6),
            shopLink: base,
            unsubscribeLink: buildUnsubscribeLink(email),
            preview: "Price drop on your wishlist",
          },
        });
        sent += 1;
      } catch {
        skipped += 1;
      }
    }
    if (lists.length < 100) break;
  }
  return { sent, skipped };
}

/** Publishable key for self-HTTP store calls (mirrors key-exchange route). */
async function getPublishableKey(container: any): Promise<string | null> {
  try {
    const apiKeys = container.resolve(Modules.API_KEY);
    const keys = await apiKeys.listApiKeys({ type: "publishable" });
    const usable = (keys || []).filter((k: any) => !k.revoked_at);
    const preferred =
      usable.find((k: any) => k.title === "Webshop") ?? usable[0];
    return preferred?.token ?? null;
  } catch {
    return null;
  }
}

/** Default market region (gb) for price context, else first region. */
async function getDefaultRegionId(regionModule: any): Promise<string | null> {
  try {
    const regions = await regionModule.listRegions(
      {},
      { relations: ["countries"], take: 100 }
    );
    if (!regions?.length) return null;
    const gb = regions.find((r: any) =>
      (r.countries || []).some((c: any) => c.iso_2 === "gb")
    );
    return (gb ?? regions[0]).id;
  } catch {
    return null;
  }
}

/**
 * Products with their lowest dropped price (null = not on sale), via the
 * same list query the storefront uses for priced cards.
 */
async function fetchPricedProducts(
  productIds: string[],
  regionId: string,
  apiKey: string,
  api: string
): Promise<(PricedProduct & { dropMin: number | null })[]> {
  const out: (PricedProduct & { dropMin: number | null })[] = [];
  // The list endpoint pages reliably; keep batches modest.
  for (let i = 0; i < productIds.length; i += 50) {
    const batch = productIds.slice(i, i + 50);
    try {
      const qs = new URLSearchParams({
        fields: "*variants.calculated_price",
        region_id: regionId,
      });
      for (const id of batch) {
        qs.append("id", id);
      }
      const res = await fetch(`${api}/store/products?${qs}`, {
        headers: { "x-publishable-api-key": apiKey },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as any;
      for (const p of data?.products || []) {
        let min: number | null = null;
        for (const v of p.variants || []) {
          const c = v.calculated_price || {};
          const now =
            typeof c.calculated_amount === "number"
              ? c.calculated_amount
              : null;
          const was =
            typeof c.original_amount === "number" ? c.original_amount : null;
          if (now == null || was == null || was <= now) continue;
          if (min == null || now < min) min = now;
        }
        out.push({
          id: p.id,
          title: p.title,
          handle: p.handle,
          thumbnail: p.thumbnail ?? null,
          dropMin: min,
        });
      }
    } catch {
      continue;
    }
  }
  return out;
}
