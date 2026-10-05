import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { expiryDate, getAccount, getSettings } from '../modules/loyalty/helpers'

/**
 * PR-13 — Earn on purchase. 1 pt per major unit of order total (currency
 * agnostic by design — documented approximation until pricing matures).
 * Guest orders earn nothing. Idempotent per order_id; expiry stamped at earn.
 */
export default async function orderPlacedLoyaltyHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER);
  const loyalty = container.resolve('rewards') as any;

  try {
    const existing = await loyalty.listLoyaltyLedgers({
      order_id: data.id,
      reason: 'earn',
    });
    if (existing.length) {
      return;
    }
    const order = await orderModuleService.retrieveOrder(data.id);
    const customerId = (order as any).customer_id as string | undefined;
    if (!customerId) {
      return;
    }
    const settings = await getSettings(loyalty);
    const points = Math.max(
      0,
      Math.round(((order as any).total ?? 0) / 100) * settings.earn_per_major
    );
    if (!points) {
      return;
    }
    await loyalty.createLoyaltyLedgers({
      customer_id: customerId,
      delta: points,
      reason: 'earn',
      order_id: order.id,
      expires_at: expiryDate(settings.expiry_months),
    });
    const account = await getAccount(loyalty, customerId);
    await loyalty.updateLoyaltyAccounts(
      { id: account.id },
      { balance: account.balance + points }
    );
    logger.info(`Loyalty: +${points} pts for customer ${customerId}.`);
  } catch (error) {
    logger.error(`Loyalty earn failed: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
