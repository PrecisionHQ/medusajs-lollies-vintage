import { model } from "@medusajs/framework/utils";

/**
 * PR-13 — Append-only points ledger. Reasons: earn | burn | reversal | expiry.
 * order_id makes earn idempotent (one row per order) and lets cancellations
 * reverse precisely. Expiry is lazy: balance reads ignore expired rows, and
 * earn writes stamp expires_at (default: 12 months of inactivity policy).
 */
export const LoyaltyLedger = model.define("loyalty_ledger", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  delta: model.number(),
  reason: model.text(),
  order_id: model.text().nullable(),
  expires_at: model.dateTime().nullable(),
});
