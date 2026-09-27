import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows";

/**
 * PR-11 — Pricing matrix API.
 *
 * Prices are per CURRENCY (one currency per region today, so this covers all
 * live regions; region-shared currencies need Price Lists — a documented
 * follow-up, not this PR). No compare-at: variant prices have no compare_at
 * field in 2.19 (only order snapshots do); sale display comes from promotions.
 *
 * GET ?product_id= → variants with money amounts (minor units).
 * POST { variantPrices: [{ variant_id, product_id, prices: [{ currency_code, amount }] }] }
 *   upserts in chunks of 50.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const productId = req.query.product_id as string | undefined;
  if (!productId) {
    res.status(400).json({ message: "product_id is required." });
    return;
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: products }: { data: any[] } = await query.graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.title", "variants.sku", "variants.prices.*"],
    filters: { id: productId },
  });
  const product = products?.[0];
  if (!product) {
    res.status(404).json({ message: "Product not found." });
    return;
  }
  res.json({
    product: { id: product.id, title: product.title },
    variants: (product.variants ?? []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      prices: (v.prices ?? []).map((p: any) => ({
        currency_code: p.currency_code,
        amount: p.amount,
      })),
    })),
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { variantPrices } = (req.body ?? {}) as {
    variantPrices?: {
      variant_id: string;
      product_id: string;
      prices: { currency_code: string; amount: number }[];
    }[];
  };
  if (!Array.isArray(variantPrices) || !variantPrices.length) {
    res.status(400).json({ message: "variantPrices must be a non-empty array." });
    return;
  }
  for (const vp of variantPrices) {
    if (!vp.variant_id || !vp.product_id || !Array.isArray(vp.prices)) {
      res.status(400).json({
        message: "Each entry needs variant_id, product_id and prices[].",
      });
      return;
    }
    for (const p of vp.prices) {
      if (!p.currency_code || !Number.isInteger(p.amount) || p.amount < 0) {
        res.status(400).json({
          message: "Prices need currency_code and a non-negative integer amount (minor units).",
        });
        return;
      }
    }
  }

  const CHUNK = 50;
  let updated = 0;
  for (let i = 0; i < variantPrices.length; i += CHUNK) {
    await upsertVariantPricesWorkflow(req.scope).run({
      input: {
        variantPrices: variantPrices.slice(i, i + CHUNK),
        previousVariantIds: [],
      },
    });
    updated += Math.min(CHUNK, variantPrices.length - i);
  }
  res.json({ updated });
};
