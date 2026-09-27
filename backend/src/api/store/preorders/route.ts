import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * PR-09 — Public preorder flags.
 * GET /store/preorders?product_id=… or ?variant_ids=a,b,c returns
 * { variant_id: { available_at, eta_text } } for flagged variants only.
 * The PDP badge and cart/checkout notices consume this (variant metadata is
 * not guaranteed on the store DTO, so this route is the contract).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const productId = req.query.product_id as string | undefined;
  const variantIds = ((req.query.variant_ids as string | undefined) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let ids = variantIds;
  if (productId) {
    const { data: products }: { data: any[] } = await query.graph({
      entity: "product",
      fields: ["variants.id"],
      filters: { id: productId, status: "published" },
    });
    ids = [...ids, ...(products?.[0]?.variants ?? []).map((v: any) => v.id)];
  }
  if (!ids.length) {
    res.json({ flags: {} });
    return;
  }

  const { data: variants }: { data: any[] } = await query.graph({
    entity: "product_variant",
    fields: ["id", "metadata"],
    filters: { id: [...new Set(ids)] },
    pagination: { take: ids.length },
  });

  const flags: Record<string, { available_at: string | null; eta_text: string | null }> = {};
  for (const v of variants ?? []) {
    if (v.metadata?.preorder) {
      flags[v.id] = {
        available_at: v.metadata.preorder.available_at ?? null,
        eta_text: v.metadata.preorder.eta_text ?? null,
      };
    }
  }
  res.json({ flags });
};
