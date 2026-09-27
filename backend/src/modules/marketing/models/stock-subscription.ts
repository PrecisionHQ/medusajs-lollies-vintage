import { model } from "@medusajs/framework/utils";

/**
 * PR-06 — Back-in-stock subscriptions.
 *
 * One row per shopper × variant. notified_at null = pending; set when the
 * restock email goes out (one email per subscription, then auto-resolved).
 * token is a random unguessable string for the emailed unsubscribe link.
 * Requested notifications bypass the marketing opt-out (explicit consent),
 * but every email still carries an unsubscribe link.
 */
export const StockSubscription = model.define("marketing_stock_subscription", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  product_id: model.text(),
  email: model.text(),
  customer_id: model.text().nullable(),
  token: model.text(),
  notified_at: model.dateTime().nullable(),
});
