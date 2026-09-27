import { model } from "@medusajs/framework/utils";

/**
 * PR-15 — 404 log. One row per normalized path, hits incremented by the
 * storefront not-found reporter. The admin page sorts by hits so the most
 * painful dead ends get redirects first.
 */
export const NotFoundLog = model.define("not_found_log", {
  id: model.id().primaryKey(),
  path: model.text(),
  hits: model.number().default(1),
  last_seen: model.dateTime().nullable(),
});
