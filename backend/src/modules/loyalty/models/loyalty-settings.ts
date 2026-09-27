import { model } from "@medusajs/framework/utils";

/**
 * PR-13 — Single settings row (key = "default"). Points are a balance-sheet
 * liability: finance signs off on earn rate, redemption value and expiry.
 * Defaults: 1 pt per major unit, 500 pts → €5, 12-month expiry.
 */
export const LoyaltySettings = model.define("loyalty_settings", {
  id: model.id().primaryKey(),
  key: model.text(),
  earn_per_major: model.number().default(1),
  burn_threshold: model.number().default(500),
  burn_value_minor: model.number().default(500),
  burn_currency: model.text().default("eur"),
  expiry_months: model.number().default(12),
});
