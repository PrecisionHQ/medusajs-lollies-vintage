import { model } from "@medusajs/framework/utils";

/**
 * PR-08 — A bundle is a named set of variants sold with an automatic
 * buy-get promotion. The discount itself lives on the Promotion
 * (type=buyget, automatic); this row links the promotion to its composition
 * so the composer, health check and storefront can render it.
 */
export const Bundle = model.define("bundle", {
  id: model.id().primaryKey(),
  promotion_id: model.text(),
  name: model.text(),
});
