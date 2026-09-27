import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * PR-07 — Admin read of one customer's wishlist, for support.
 * GET /admin/wishlists?customer_id=… returns items with product titles.
 * Read-only: shoppers manage their own lists on the storefront.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = req.query.customer_id as string | undefined;
  if (!customerId) {
    res.status(400).json({ message: "customer_id is required." });
    return;
  }
  const wishlists = req.scope.resolve("wishlist") as any;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const lists = await wishlists.listWishlists({ customer_id: customerId });
  if (!lists.length) {
    res.json({ items: [], count: 0 });
    return;
  }
  const items = await wishlists.listWishlistItems(
    { wishlist_id: lists[0].id },
    { take: 100 }
  );
  const productIds = [...new Set(items.map((i: any) => i.product_id))];
  let titles = new Map<string, string>();
  if (productIds.length) {
    const result = await query.graph({
      entity: "product",
      fields: ["id", "title"],
      filters: { id: productIds },
      pagination: { take: productIds.length },
    });
    titles = new Map((result.data ?? []).map((p: any) => [p.id, p.title]));
  }
  res.json({
    items: items.map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      product_title: titles.get(i.product_id) ?? i.product_id,
      variant_id: i.variant_id,
    })),
    count: items.length,
  });
};
