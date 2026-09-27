import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

/**
 * PR-09 — Preorder flags live in variant metadata (`metadata.preorder`), so
 * no migration is needed. ETA text is REQUIRED when flagging (a preorder
 * without a date is a support ticket waiting to happen).
 *
 * GET lists flagged variants (product titles included). POST sets or clears:
 * { variant_id, preorder: { available_at, eta_text } | null }.
 * Clearing writes preorder:null (metadata merges — null reads as off).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: variants }: { data: any[] } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "metadata", "product.id", "product.title"],
    pagination: { take: 200 },
  });
  res.json({
    preorders: (variants ?? [])
      .filter((v) => v.metadata?.preorder)
      .map((v) => ({
        variant_id: v.id,
        variant_title: v.title,
        product_id: v.product?.id ?? null,
        product_title: v.product?.title ?? null,
        available_at: v.metadata.preorder.available_at ?? null,
        eta_text: v.metadata.preorder.eta_text ?? null,
      })),
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const products = req.scope.resolve(Modules.PRODUCT);
  const { variant_id, preorder } = (req.body ?? {}) as {
    variant_id?: string;
    preorder?: { available_at?: string; eta_text?: string } | null;
  };

  if (!variant_id) {
    res.status(400).json({ message: "variant_id is required." });
    return;
  }
  if (preorder !== null && preorder !== undefined) {
    if (!preorder.eta_text?.trim()) {
      res
        .status(400)
        .json({ message: "eta_text is required when flagging a preorder." });
      return;
    }
  }

  const variant = await products.retrieveProductVariant(variant_id).catch(() => null);
  if (!variant || !variant.product_id) {
    res.status(404).json({ message: "Variant not found." });
    return;
  }

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: [
        {
          id: variant.product_id,
          variants: [
            {
              id: variant_id,
              metadata: {
                ...(variant.metadata ?? {}),
                preorder: preorder ?? null,
              },
            },
          ],
        },
      ],
    },
  });
  res.json({ ok: true });
};
