import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService, IPaymentModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * PR-09 — Release authorizations when an order is canceled.
 *
 * A canceled preorder must not hold the shopper's funds: every payment on
 * the order gets cancelPayment (voids uncaptured authorizations; already
 * captured payments fail loudly in the log so finance can refund manually).
 */
export default async function orderCanceledReleaseHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER);
  const paymentModuleService: IPaymentModuleService =
    container.resolve(Modules.PAYMENT);

  try {
    // Cast: same relation note as order-fulfillment-capture.ts.
    const order = (await orderModuleService.retrieveOrder(data.id, {
      relations: ['payment_collections', 'payment_collections.payments'],
    })) as any;
    const payments = (order.payment_collections ?? []).flatMap(
      (pc: any) => pc.payments ?? []
    );
    for (const payment of payments) {
      try {
        await paymentModuleService.cancelPayment(payment.id);
        logger.info(`Released payment ${payment.id} for canceled order ${order.id}.`);
      } catch (error) {
        logger.error(
          `Could not release payment ${payment.id} (may need manual refund): ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    logger.error(`Cancel release failed: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
}
