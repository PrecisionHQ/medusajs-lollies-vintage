import { model } from "@medusajs/framework/utils";

/**
 * Owned newsletter list. Replaces the Modave theme's external Brevo post:
 * subscriber emails now stay in our database instead of flowing to an
 * unidentified third party.
 *
 * Lifecycle: pending (subscribed, confirm mail sent) → confirmed (clicked the
 * emailed link) → unsubscribed (via /unsubscribe, which also writes a
 * MarketingOptOut so the flows respect it). confirm_token is a random
 * single-purpose string; kept after confirming so re-clicks stay idempotent.
 * source records where the address came from (footer|popup) for list hygiene.
 * Duplicates are resolved in code (find-first by email), matching the
 * FlowLog idempotency convention.
 */
export const NewsletterSubscription = model.define(
  "marketing_newsletter_subscription",
  {
    id: model.id().primaryKey(),
    email: model.text(),
    status: model.text().default("pending"),
    source: model.text().nullable(),
    confirm_token: model.text().nullable(),
    confirmed_at: model.dateTime().nullable(),
  }
);
