import { Modules } from "@medusajs/framework/utils";
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { notifyPushSubscribers } from "../modules/push/push-sender";

/**
 * Owner PWA — new-order ping.
 *
 * Same pattern as the question/review pings: admin-bound installs only
 * (`adminOnly`), fire-and-forget, never fails the order. Body carries the
 * total + item count so the owner can triage from the lock screen.
 */
export default async function orderPlacedPushHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const orderModule = container.resolve(Modules.ORDER) as any;
    const order = await orderModule.retrieveOrder(data.id).catch(() => null);
    if (!order) {
      return;
    }
    const total = `${Number(order.total ?? 0) / 100} ${(order.currency_code ?? "eur").toUpperCase()}`;
    const items = (order.items ?? []).reduce(
      (n: number, i: any) => n + Number(i.quantity ?? 0),
      0
    );
    await notifyPushSubscribers(
      container,
      {
        title: `New order ${total}`,
        body: `${items} item${items === 1 ? "" : "s"} from ${order.email ?? "the shop"} — open the app to fulfill.`,
      },
      { adminOnly: true }
    ).catch(() => {});
  } catch {
    // Push must never break order placement.
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
