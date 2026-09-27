import Medusa from "@medusajs/js-sdk";

/**
 * Shared JS SDK for admin customizations (routes + widgets).
 * Same-origin with session auth: the dashboard's own login carries over,
 * so no key handling is needed here.
 */
export const sdk = new Medusa({
  baseUrl: "/",
  debug: process.env.NODE_ENV === "development",
  auth: { type: "session" },
});
