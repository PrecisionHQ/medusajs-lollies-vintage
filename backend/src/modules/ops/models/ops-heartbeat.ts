import { model } from "@medusajs/framework/utils";

/**
 * Attention hub — one row per scheduled job / key subscriber. Writers are
 * the jobs themselves (see heartbeat.ts); readers are the ops aggregator
 * and, through it, the dashboard + PWA. No runs history: last_ok_at +
 * last_error is the whole state the hub needs.
 */
export const OpsHeartbeat = model.define("ops_heartbeat", {
  id: model.id().primaryKey(),
  /** Job name, e.g. "abandoned-cart", "flow-nudge-daily". Unique. */
  name: model.text().unique(),
  last_ok_at: model.dateTime().nullable(),
  /** First 280 chars of the latest error, or null when healthy. */
  last_error: model.text().nullable(),
});
