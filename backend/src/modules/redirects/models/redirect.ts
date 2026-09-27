import { model } from "@medusajs/framework/utils";

/**
 * PR-15 — URL redirect. from_path is stored normalized (lowercase, leading
 * slash, no trailing slash) and unique per row (enforced in code). status is
 * 301 (permanent — link equity moves) or 302 (temporary).
 */
export const Redirect = model.define("redirect", {
  id: model.id().primaryKey(),
  from_path: model.text(),
  to_path: model.text(),
  status_code: model.number().default(301),
});
