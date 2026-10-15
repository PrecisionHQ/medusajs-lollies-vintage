import { model } from "@medusajs/framework/utils";

/**
 * Phase 4 (F1) — affiliate creators. Closed-program model: invite-only
 * creators with a commission rate, a personal promo code (minted through
 * the promotions API), and a referral link (plain utm link — the
 * middleware plants the cookie from query params, no /r/ route needed).
 * Attribution (visits, redemptions, owed) lands in F2; payouts in F3.
 */
export const AffiliateCreator = model.define("affiliate_creator", {
  id: model.id().primaryKey(),
  /** Display name, e.g. "Adaeze Okafor". */
  name: model.text(),
  /** Unique handle, e.g. "adaeze"; doubles as the utm_campaign. */
  handle: model.text().unique(),
  /** Platform: instagram | tiktok | youtube | blog | other. */
  platform: model.text().default("instagram"),
  /** Commission percent on attributed revenue, e.g. 10 = 10%. */
  commission_pct: model.number().default(10),
  /** Personal promo code once minted (nullable until then). */
  code: model.text().nullable(),
  /** active | paused. */
  status: model.text().default("active"),
});
