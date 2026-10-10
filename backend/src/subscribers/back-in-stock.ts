import { Modules } from '@medusajs/framework/utils';
import { INotificationModuleService } from '@medusajs/framework/types';
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa';
import { EmailTemplates } from '../modules/email-notifications/templates';
import { RESEND_FROM_EMAIL, STOREFRONT_URL } from '../lib/constants';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * PR-06 — Back-in-stock notifications.
 *
 * Fires on `inventory-level.updated` (payload: the level id). Only acts when
 * the level's available quantity (stocked − reserved) crosses STOCK_THRESHOLD
 * — a single returned unit must not trigger a mail blast.
 *
 * Pending subscriptions are checked against live variant availability
 * (bounded to 200 per run; add an item-id index + filter if this ever grows).
 * Each subscription resolves exactly once: notified_at is set in the same
 * pass, and per-subscription errors are caught so one bad row can't block
 * the rest.
 */

const STOCK_THRESHOLD = 5;

type PendingSub = {
  id: string;
  variant_id: string;
  email: string;
  token: string;
};

export default async function backInStockHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const marketing = container.resolve('marketing') as any;
  const notificationModuleService: INotificationModuleService =
    container.resolve(Modules.NOTIFICATION);

  try {
    const { data: levels }: { data: { stocked_quantity: number; reserved_quantity: number }[] } =
      await query.graph({
        entity: 'inventory_level',
        fields: ['stocked_quantity', 'reserved_quantity'],
        filters: { id: data.id },
      });
    const level = levels?.[0];
    if (!level) {
      return;
    }
    const available = (level.stocked_quantity ?? 0) - (level.reserved_quantity ?? 0);
    if (available < STOCK_THRESHOLD) {
      return;
    }

    const subs: PendingSub[] = await marketing.listStockSubscriptions(
      {},
      { take: 200 }
    );
    const pending = subs.filter((s) => !((s as any).notified_at ?? null));
    if (!pending.length) {
      return;
    }

    const { data: variants }: { data: { id: string; inventory_quantity: number | null; product?: { handle?: string; title?: string } | null }[] } =
      await query.graph({
        entity: 'product_variant',
        fields: ['id', 'inventory_quantity', 'product.handle', 'product.title'],
        filters: { id: [...new Set(pending.map((s) => s.variant_id))] },
        pagination: { take: pending.length },
      });
    const byVariant = new Map((variants ?? []).map((v) => [v.id, v]));
    const base = STOREFRONT_URL.replace(/\/$/, '');

    for (const sub of pending) {
      try {
        const variant = byVariant.get(sub.variant_id);
        if (!variant || (variant.inventory_quantity ?? 0) < STOCK_THRESHOLD) {
          continue;
        }
        await marketing.updateStockSubscriptions({
          id: sub.id,
          notified_at: new Date(),
        });
        await notificationModuleService.createNotifications({
          to: sub.email,
          channel: 'email',
          template: EmailTemplates.BACK_IN_STOCK,
          data: {
            emailOptions: {
              replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
              subject: `${variant.product?.title ?? 'An item'} is back in stock`,
            },
            productTitle: variant.product?.title ?? 'Your item',
            variantTitle: null,
            productLink: variant.product?.handle
              ? `${base}/products/${variant.product.handle}`
              : base,
            unsubscribeLink: `${base}/unsubscribe?scope=stock&id=${sub.id}&token=${sub.token}`,
            preview: 'Back in stock',
          },
        });
      } catch (error) {
        logger.warn(
          `back-in-stock: skipping subscription ${sub.id}: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    logger.error(`back-in-stock handler failed: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'inventory-level.updated',
};
