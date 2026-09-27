import { model } from "@medusajs/framework/utils";

/**
 * PR-08 — One row per variant in a bundle set, with the required quantity.
 */
export const BundleComponent = model.define("bundle_component", {
  id: model.id().primaryKey(),
  bundle_id: model.text(),
  variant_id: model.text(),
  quantity: model.number().default(1),
});
