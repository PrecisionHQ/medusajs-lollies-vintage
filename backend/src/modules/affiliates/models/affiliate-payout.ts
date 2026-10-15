import { model } from "@medusajs/framework/utils";

/**
 * Phase 4 (F3) — manual payout ledger. One row per payment to a creator
 * (amount, currency, free-text note: "PayPal <id>", "bank transfer", …).
 * Manual-first by design: auto-payouts come only after the closed program
 * proves out. Boards show windowed owed next to all-time paid and
 * deliberately do NOT compute a balance (windowed-minus-lifetime would
 * lie); the pay form prefills the windowed owed as a convenience.
 */
export const AffiliatePayout = model.define("affiliate_payout", {
  id: model.id().primaryKey(),
  creator_id: model.text(),
  amount_minor: model.number(),
  currency: model.text().default("eur"),
  note: model.text().nullable(),
});
