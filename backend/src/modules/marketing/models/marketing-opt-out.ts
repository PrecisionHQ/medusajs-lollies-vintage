import { model } from "@medusajs/framework/utils";

/**
 * Marketing opt-outs. Checked by every flow before sending.
 * Written by the unauthenticated unsubscribe link (the emailed HMAC token
 * is the proof of ownership — see src/api/store/marketing/unsubscribe).
 */
export const MarketingOptOut = model.define("marketing_opt_out", {
  id: model.id().primaryKey(),
  email: model.text(),
  // DML auto-adds created_at/updated_at to every model, so no explicit field.
});
