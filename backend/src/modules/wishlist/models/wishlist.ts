import { model } from "@medusajs/framework/utils";

/**
 * PR-07 — One wishlist per customer (enforced in code: find-or-create by
 * customer_id; DML has no unique constraint primitive).
 */
export const Wishlist = model.define("wishlist", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
});
