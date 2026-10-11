import { model } from "@medusajs/framework/utils";

/**
 * Ads v1 — Manual ad-spend ledger (the cost side of ROAS). Revenue comes
 * from PostHog (order_placed broken down by utm_source/utm_campaign);
 * this table holds what was spent. amount_minor follows Medusa money
 * convention (integer minor units); the admin form takes major decimals.
 */
export const MarketingAdSpend = model.define("marketing_ad_spend", {
  id: model.id().primaryKey(),
  spend_date: model.text(),
  source: model.text(),
  campaign: model.text().nullable(),
  amount_minor: model.number(),
  currency: model.text().default("eur"),
});
