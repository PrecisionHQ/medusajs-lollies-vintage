import { model } from "@medusajs/framework/utils";

/**
 * PR-13 — One loyalty account per customer. balance is a cached sum of
 * unexpired ledger deltas, maintained by the earn/burn/reverse paths
 * (recomputed nowhere else — keep all writes in those three places).
 */
export const LoyaltyAccount = model.define("loyalty_account", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  balance: model.number().default(0),
});
