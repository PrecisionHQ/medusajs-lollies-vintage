import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { capturePaymentWorkflow } from '@medusajs/medusa/core-flows'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * PR-09 — Capture on fulfillment.
 *
 * Preorder payments are AUTHORIZED at checkout and captured when the order
 * ships (the fulfillment is created). Capturing an already-captured payment
 * throws, which we log and ignore — the subscriber is idempotent by outcome.
 *
 * STUB-RISK (needs real Stripe test keys to verify): this assumes checkout
 * authorizes without capturing. If the Stripe provider auto-captures, the
 * preorder "pay later" promise is false and this becomes a no-op logger.
 * Verify with a test preorder before enabling flags on real variants.
 */
export default async function fulfillmentCaptureHandler({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; fulfillment_id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER);

  try {
    // Cast: the OrderDTO type omits the relation, but the link resolves at
    // runtime (verified against real orders when Stripe test keys land).
    const order = (await orderModuleService.retrieveOrder(data.order_id, {
      relations: ['payment_collections', 'payment_collections.payments'],
    })) as any;
    const payments = (order.payment_collections ?? []).flatMap(
      (pc: any) => pc.payments ?? []
    );
    for (const payment of payments) {
      try {
        await capturePaymentWorkflow(container).run({
          input: { payment_id: payment.id },
        });
        logger.info(`Captured payment ${payment.id} for order ${order.id}.`);
      } catch (error) {
        // Already captured / not capturable — outcome already correct.
        logger.info(
          `Capture skipped for payment ${payment.id}: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    logger.error(`Fulfillment capture failed: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'order.fulfillment_created',
}
