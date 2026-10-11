import { Modules } from "@medusajs/framework/utils";
import { EmailTemplates } from "../email-notifications/templates";
import { RESEND_FROM_EMAIL, STOREFRONT_URL } from "../../lib/constants";
import { buildUnsubscribeLink } from "./utils";
import {
  alreadySent,
  claimSend,
  isOptedOut,
  recentlyEmailed,
} from "./flow-guards";

/**
 * P9 — Post-purchase cross-sell ("Complete the look").
 *
 * Daily job picks orders placed 2-3 days ago, finds products sharing
 * collections with the ordered items (excluding them), and mails up to 4
 * with the CAMPAIGN template. Guarded like every flow (opt-out, 3-day cap,
 * idempotent per order). No affinity, no mail — a generic blast would be
 * spam, not cross-sell.
 */
export async function runCrossSell(
  container: any
): Promise<{ sent: number; skipped: number }> {
  const marketing = container.resolve("marketing") as any;
  const notifications = container.resolve(Modules.NOTIFICATION);
  const orderModule = container.resolve(Modules.ORDER);
  const productModule = container.resolve(Modules.PRODUCT);
  const base = STOREFRONT_URL.replace(/\/$/, "");
  const now = Date.now();

  const orders = await orderModule
    .listOrders(
      {
        created_at: {
          $gte: new Date(now - 3 * 24 * 3600 * 1000),
          $lt: new Date(now - 2 * 24 * 3600 * 1000),
        },
      },
      { relations: ["items"], take: 200 }
    )
    .catch(() => []);

  let sent = 0,
    skipped = 0;
  for (const order of orders || []) {
    try {
      const email = (order.email || "").trim().toLowerCase();
      if (!email) {
        skipped += 1;
        continue;
      }
      if (
        (await alreadySent(marketing, "cross-sell", order.id)) ||
        (await isOptedOut(marketing, email)) ||
        (await recentlyEmailed(marketing, email))
      ) {
        skipped += 1;
        continue;
      }

      const orderedIds = [
        ...new Set(
          ((order.items || []) as any[])
            .map((i) => i.product_id)
            .filter(Boolean)
        ),
      ] as string[];
      if (!orderedIds.length) {
        skipped += 1;
        continue;
      }
      const ordered = await productModule
        .listProducts(
          { id: orderedIds },
          { select: ["id", "collection_id"], take: orderedIds.length }
        )
        .catch(() => []);
      const collections = [
        ...new Set(
          (ordered || [])
            .map((p: any) => p.collection_id)
            .filter(Boolean)
        ),
      ] as string[];
      if (!collections.length) {
        skipped += 1;
        continue;
      }
      const pool = await productModule
        .listProducts(
          { collection_id: collections },
          { select: ["id", "title", "handle", "thumbnail"], take: 20 }
        )
        .catch(() => []);
      const picks = ((pool || []) as any[])
        .filter((p) => p?.id && !orderedIds.includes(p.id))
        .slice(0, 4);
      if (!picks.length) {
        skipped += 1;
        continue;
      }

      await claimSend(marketing, "cross-sell", order.id, email);
      await notifications.createNotifications({
        to: email,
        channel: "email",
        template: EmailTemplates.CAMPAIGN,
        data: {
          emailOptions: {
            replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
            subject: "Complete the look",
          },
          headline: "Complete the look",
          body: "Pairs well with what you just ordered.",
          ctaLabel: "Shop all",
          ctaHref: `${base}/store`,
          products: picks.map((p: any) => ({
            title: p.title,
            image: p.thumbnail ?? null,
            price: null,
            link: `${base}/products/${p.handle}`,
          })),
          shopLink: base,
          unsubscribeLink: buildUnsubscribeLink(email),
          preview: "Complete the look",
        },
      });
      sent += 1;
    } catch {
      skipped += 1;
    }
  }
  return { sent, skipped };
}
