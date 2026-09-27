import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { IPromotionModuleService } from "@medusajs/framework/types";

/**
 * PR-08 — Store bundles containing a product.
 * GET /store/bundles?product_id=… returns ACTIVE bundles only, with components
 * enriched (variant/product titles, thumbnail, EUR price) and a display label
 * for the discount. The PDP "Complete the set" rail consumes this.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = req.query.product_id as string | undefined;
  if (!productId) {
    res.status(400).json({ message: "product_id is required." });
    return;
  }
  const bundles = req.scope.resolve("bundle") as any;
  const promotions: IPromotionModuleService = req.scope.resolve(
    Modules.PROMOTION
  );
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const all = await bundles.listBundles({}, { take: 100 });
  const out = [];
  for (const b of all) {
    const promo = await promotions
      .retrievePromotion(b.promotion_id, {
        relations: ["application_method"],
      })
      .catch(() => null);
    if (!promo || promo.status !== "active") {
      continue;
    }
    const components = await bundles.listBundleComponents(
      { bundle_id: b.id },
      { take: 50 }
    );
    if (!components.length) {
      continue;
    }
    const variantIds = components.map((c: any) => c.variant_id);
    const result = await query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "title",
        "product_id",
        "prices.amount",
        "prices.currency_code",
        "product.title",
        "product.handle",
        "product.thumbnail",
      ],
      filters: { id: variantIds },
      pagination: { take: variantIds.length },
    });
    const byVariant = new Map((result.data ?? []).map((v: any) => [v.id, v]));
    if (![...byVariant.values()].some((v: any) => v.product_id === productId)) {
      continue;
    }
    const method = promo.application_method as any;
    out.push({
      id: b.id,
      name: b.name,
      discount_label:
        method?.type === "percentage"
          ? `${method.value}% off the set`
          : method?.type === "fixed"
          ? `${(method.value / 100).toFixed(2)} ${(method.currency_code ?? "").toUpperCase()} off the set`
          : "Bundle saving",
      components: components.map((c: any) => {
        const v = byVariant.get(c.variant_id) as any;
        const eur = v?.prices?.find((p: any) => p.currency_code === "eur");
        return {
          variant_id: c.variant_id,
          quantity: c.quantity,
          variant_title: v?.title ?? null,
          product_title: v?.product?.title ?? null,
          product_handle: v?.product?.handle ?? null,
          product_thumbnail: v?.product?.thumbnail ?? null,
          eur_price: eur?.amount ?? null,
        };
      }),
    });
  }
  res.json({ bundles: out });
};
