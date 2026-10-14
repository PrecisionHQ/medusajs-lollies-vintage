import { model } from "@medusajs/framework/utils";

/**
 * PWA phone app — Web Push subscriptions, one row per installed app.
 *
 * endpoint + p256dh/auth are the push-service credentials from
 * pushManager.subscribe(); user_id is the admin user when known (null
 * for same-device installs that never re-logged); device tags the
 * surface ("phone" | "desktop") so sends can target either or both.
 * Rows die young: the sender deletes any subscription the push service
 * reports as gone (410/404), so no separate janitor is needed.
 */
export const PushSubscription = model.define("push_subscription", {
  id: model.id().primaryKey(),
  endpoint: model.text().unique(),
  p256dh: model.text(),
  auth: model.text(),
  user_id: model.text().nullable(),
  device: model.text().default("phone"),
});
