import { model } from "@medusajs/framework/utils";

/**
 * Phase 4 (F2) — referral link hits. One row per landing, no PII (handle
 * + timestamp only). Advisory by design: ad/tracking blockers and dropped
 * beacons undercount visits, so payouts key on redemptions (authoritative),
 * never on this table.
 */
export const AffiliateHit = model.define("affiliate_hit", {
  id: model.id().primaryKey(),
  handle: model.text(),
});
