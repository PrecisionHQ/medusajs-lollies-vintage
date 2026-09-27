import { model } from "@medusajs/framework/utils";

/**
 * PR-07 — One row per saved product (variant optional: shoppers save the
 * product, and pick the variant when moving it to cart).
 */
export const WishlistItem = model.define("wishlist_item", {
  id: model.id().primaryKey(),
  wishlist_id: model.text(),
  product_id: model.text(),
  variant_id: model.text().nullable(),
});
