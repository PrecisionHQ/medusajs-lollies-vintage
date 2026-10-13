import { model } from "@medusajs/framework/utils";

/**
 * Product Q&A (#11). Guests may ask (pre-purchase shoppers often have no
 * account yet), so customer_id is nullable and email is required for the
 * shop's reply. status: open (default, invisible on the storefront) |
 * answered (visible) | closed. No explicit timestamps: DML adds them.
 */
export const Question = model.define("question", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  customer_id: model.text().nullable(),
  name: model.text(),
  email: model.text(),
  question: model.text(),
  answer: model.text().nullable(),
  status: model.text().default("open"),
  locale: model.text().nullable(),
});
