import { Modules } from "@medusajs/framework/utils";
import { buildUnsubscribeLink } from "./utils";
import { STOREFRONT_URL } from "../../lib/constants";

export type CampaignProductRow = {
  title: string;
  image?: string | null;
  price?: string | null;
  link: string;
};

export type CampaignRow = {
  id: string;
  subject: string;
  headline: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
  product_handles: string | null;
};

/**
 * P2 — Shared campaign email assembly (preview + test-send; batch send
 * lands in P3). Resolves up to 4 product handles to title/image/link rows
 * (unknown handles skipped) and stamps the per-recipient unsubscribe link.
 */
export async function buildCampaignEmailData(
  scope: { resolve: (key: string) => any },
  campaign: CampaignRow,
  opts: { email: string; preview?: boolean }
): Promise<Record<string, unknown>> {
  const handles = (campaign.product_handles || "")
    .split(/[\n,]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4);

  const base = STOREFRONT_URL.replace(/\/$/, "");
  const rawCta = campaign.cta_href || "/";
  // Emails need absolute URLs: bare paths resolve against the shop.
  const ctaHref = /^https?:\/\//i.test(rawCta) ? rawCta : `${base}${rawCta.startsWith("/") ? rawCta : `/${rawCta}`}`;

  let products: CampaignProductRow[] = [];
  if (handles.length) {
    try {
      const productModule = scope.resolve(Modules.PRODUCT);
      const found = await productModule.listProducts(
        { handle: handles },
        { select: ["id", "title", "handle", "thumbnail"], take: 4 }
      );
      products = (found || []).map((p: any) => ({
        title: p.title,
        image: p.thumbnail ?? null,
        price: null,
        link: `${base}/products/${p.handle}`,
      }));
    } catch {
      products = [];
    }
  }

  return {
    headline: campaign.headline,
    body: campaign.body,
    ctaLabel: campaign.cta_label || "Shop now",
    ctaHref,
    products,
    shopLink: base,
    unsubscribeLink: opts.preview
      ? "#preview"
      : buildUnsubscribeLink(opts.email),
  };
}
