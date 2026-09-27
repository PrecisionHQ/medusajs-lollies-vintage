import { model } from "@medusajs/framework/utils";

/**
 * PR-04 — Product reviews.
 *
 * status: pending (default, invisible until moderated) | approved | rejected.
 * verified: set when the author account has a delivered order containing the
 *   product (checked at creation for authed authors, backfilled by script).
 * Authed-only posting in v1 (per SHOPIFY-PARITY.md Appendix B): customer_id
 * is required; name falls back to the account email prefix.
 */
export const Review = model.define("review", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  // Null for legacy rows from the Shopify import (no Medusa account to link).
  customer_id: model.text().nullable(),
  name: model.text(),
  rating: model.number(),
  title: model.text().nullable(),
  body: model.text(),
  status: model.text().default("pending"),
  verified: model.boolean().default(false),
  helpful_count: model.number().default(0),
  locale: model.text().nullable(),
});
