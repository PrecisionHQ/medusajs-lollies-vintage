import { Module } from "@medusajs/framework/utils";
import LoyaltyModuleService from "./service";

// Registered as "rewards" (NOT "loyalty"): the official
// @medusajs/loyalty-plugin already owns the "loyalty" container key, and
// its gift-card-store-credit link resolves that key with first-match
// semantics — sharing it breaks the build ("Key gift_card_id is not
// linkable on service loyalty"). API route paths stay /loyalty/*.
export const LOYALTY_MODULE = "rewards";

export default Module(LOYALTY_MODULE, {
  service: LoyaltyModuleService,
});
