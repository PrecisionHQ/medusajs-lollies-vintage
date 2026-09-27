import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * PR-07 — Shopper wishlist. All routes require a signed-in customer
 * (auth_context.actor_id); there are no guest wishlists in v1.
 *
 * GET returns items enriched with product title/handle/thumbnail + variant
 * title for storefront rendering. POST is idempotent per product × variant.
 * DELETE removes one item (ownership enforced via the wishlist's customer).
 * Move-to-cart stays frontend-side: addToCart + DELETE.
 */

async function getOrCreateWishlist(wishlist: any, customerId: string) {
  const existing = await wishlist.listWishlists({ customer_id: customerId });
  if (existing.length) {
    return existing[0];
  }
  const [created] = await wishlist.createWishlists({ customer_id: customerId });
  return created;
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to view your wishlist." });
    return;
  }
  const wishlists = req.scope.resolve("wishlist") as any;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const list = await getOrCreateWishlist(wishlists, customerId);
  const items = await wishlists.listWishlistItems(
    { wishlist_id: list.id },
    { take: 100, order: { created_at: "DESC" } }
  );

  const productIds = [...new Set(items.map((i: any) => i.product_id))];
  let products: any[] = [];
  if (productIds.length) {
    const result = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "thumbnail", "variants.id", "variants.title"],
      filters: { id: productIds },
      pagination: { take: productIds.length },
    });
    products = result.data ?? [];
  }
  const byId = new Map(products.map((p: any) => [p.id, p]));

  res.json({
    items: items.map((i: any) => {
      const product = byId.get(i.product_id) as any;
      const variant = product?.variants?.find((v: any) => v.id === i.variant_id);
      return {
        id: i.id,
        product_id: i.product_id,
        variant_id: i.variant_id,
        product_title: product?.title ?? null,
        product_handle: product?.handle ?? null,
        product_thumbnail: product?.thumbnail ?? null,
        variant_title: variant?.title ?? null,
      };
    }),
  });
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to save to your wishlist." });
    return;
  }
  const { product_id, variant_id } = (req.body ?? {}) as {
    product_id?: string;
    variant_id?: string | null;
  };
  if (!product_id) {
    res.status(400).json({ message: "product_id is required." });
    return;
  }

  const wishlists = req.scope.resolve("wishlist") as any;
  const list = await getOrCreateWishlist(wishlists, customerId);
  const existing = await wishlists.listWishlistItems({
    wishlist_id: list.id,
    product_id,
    variant_id: variant_id ?? null,
  });
  if (existing.length) {
    res.json({ item: { id: existing[0].id }, deduped: true });
    return;
  }
  const [created] = await wishlists.createWishlistItems({
    wishlist_id: list.id,
    product_id,
    variant_id: variant_id ?? null,
  });
  res.status(201).json({ item: { id: created.id }, deduped: false });
};

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to manage your wishlist." });
    return;
  }
  const { id } = (req.body ?? {}) as { id?: string };
  const wishlists = req.scope.resolve("wishlist") as any;
  const list = await getOrCreateWishlist(wishlists, customerId);
  const rows = await wishlists.listWishlistItems({ id });
  const item = rows[0] as any;
  if (!item || item.wishlist_id !== list.id) {
    res.status(404).json({ message: "Wishlist item not found." });
    return;
  }
  await wishlists.deleteWishlistItems([id]);
  res.json({ deleted: true });
};
