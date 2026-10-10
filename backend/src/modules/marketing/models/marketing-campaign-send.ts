import { model } from "@medusajs/framework/utils";

/**
 * P3 — Per-recipient campaign send log. Doubles as the resume guard: a
 * crashed or overlapping run skips any (campaign, email) row already
 * present, so no recipient ever gets the same campaign twice. Rows are
 * written for sent + failed only (opt-outs are skipped silently).
 */
export const MarketingCampaignSend = model.define("marketing_campaign_send", {
  id: model.id().primaryKey(),
  campaign_id: model.text(),
  email: model.text(),
  status: model.text(),
  error: model.text().nullable(),
  sent_at: model.dateTime().nullable(),
});
