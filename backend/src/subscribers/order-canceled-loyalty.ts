import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { getAccount } from '../modules/loyalty/helpers'

/**
 * PR-13 — Reverse earn when an order is canceled. Finds the earn row by
 * order_id and writes a matching negative row (ledger stays append-only).
 * Partial refunds do NOT auto-reverse — adjust manually (documented gap).
 */
export default async function orderCanceledLoyaltyHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER);
  const loyalty = container.resolve('rewards') as any;

  try {
    const order = await orderModuleService.retrieveOrder(data.id);
    const customerId = (order as any).customer_id as string | undefined;
    if (!customerId) {
      return;
    }
    const earned = await loyalty.listLoyaltyLedgers({
      order_id: order.id,
      reason: 'earn',
    });
    const reversed = await loyalty.listLoyaltyLedgers({
      order_id: order.id,
      reason: 'reversal',
    });
    for (const row of earned) {
      if (reversed.some((r: any) => r.order_id === row.order_id)) {
        continue;
      }
      await loyalty.createLoyaltyLedgers({
        customer_id: customerId,
        delta: -row.delta,
        reason: 'reversal',
        order_id: order.id,
        expires_at: null,
      });
      const account = await getAccount(loyalty, customerId);
      await loyalty.updateLoyaltyAccounts({
        id: account.id,
        balance: Math.max(0, account.balance - row.delta),
      });
    }
    logger.info(`Loyalty: reversed earn for canceled order ${order.id}.`);
  } catch (error) {
    logger.error(`Loyalty reversal failed: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
}
