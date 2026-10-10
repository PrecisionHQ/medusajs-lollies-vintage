import { model } from "@medusajs/framework/utils";

/**
 * Campaign drafts (P2 composer; batch sending lands in P3).
 * product_handles is newline-separated product handles (optional, max 4
 * honored at render); status transitions draft -> scheduled -> sending
 * -> sent are enforced by the admin API, not the DB.
 */
export const MarketingCampaign = model.define("marketing_campaign", {
  id: model.id().primaryKey(),
  subject: model.text(),
  headline: model.text(),
  body: model.text(),
  cta_label: model.text().default("Shop now"),
  cta_href: model.text().default("/"),
  product_handles: model.text().default(""),
  status: model.text().default("draft"),
  scheduled_at: model.dateTime().nullable(),
});
