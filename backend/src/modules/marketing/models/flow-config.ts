import { model } from "@medusajs/framework/utils";

/**
 * Singleton-ish config row for the abandoned-cart flow (key = "abandoned_cart").
 * One row keeps the admin UI to a single form; the job reads it every run.
 */
export const FlowConfig = model.define("marketing_flow_config", {
  id: model.id().primaryKey(),
  key: model.text(),
  enabled: model.boolean().default(true),
  /** Hours after last cart activity before reminder #1. */
  delay_hours: model.number().default(4),
  /** Hours after reminder #1 before reminder #2. */
  second_delay_hours: model.number().default(24),
  second_enabled: model.boolean().default(true),
  /** Static incentive code appended to reminder #2 when enabled (PR-02 v1). */
  incentive_enabled: model.boolean().default(false),
  incentive_code: model.text().nullable(),
});
