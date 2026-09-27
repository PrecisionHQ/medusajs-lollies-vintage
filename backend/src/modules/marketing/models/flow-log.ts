import { model } from "@medusajs/framework/utils";

/**
 * One row per marketing email sent. Serves two jobs:
 *  - idempotency: `flow:reference_id` (e.g. `abandoned-1:cart_123`) is written
 *    before/after sending so a re-run never double-sends;
 *  - frequency cap: recipient + sent_at window queries ("1 mail / 3 days").
 */
export const FlowLog = model.define("marketing_flow_log", {
  id: model.id().primaryKey(),
  /** Flow name, e.g. "abandoned-1", "abandoned-2". */
  flow: model.text(),
  /** What triggered it, e.g. the cart id. */
  reference_id: model.text(),
  /** Idempotency key: `${flow}:${reference_id}`. Enforced in code (find-first). */
  idempotency_key: model.text(),
  recipient: model.text(),
  sent_at: model.dateTime(),
});
