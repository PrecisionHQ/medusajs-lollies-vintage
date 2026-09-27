import { PostHog } from 'posthog-node'
import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { POSTHOG_ENABLED, POSTHOG_HOST, POSTHOG_KEY } from '../lib/constants'

/**
 * PR-05 — Server-side order.placed mirror for PostHog.
 *
 * The storefront also fires order_placed (source: "storefront") for funnel
 * position; this event (source: "server") is the reliable revenue record —
 * it fires even if the shopper closes the tab before confirmation renders.
 * Inert until POSTHOG_KEY is a real key (see KEYS.md).
 */
export default async function orderPlacedAnalyticsHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  if (!POSTHOG_ENABLED) {
    return
  }

  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

  let client: PostHog | null = null
  try {
    const order = await orderModuleService.retrieveOrder(data.id, {
      relations: ['items'],
    })

    client = new PostHog(POSTHOG_KEY as string, { host: POSTHOG_HOST })
    client.capture({
      distinctId: order.customer_id || order.email,
      event: 'order_placed',
      properties: {
        source: 'server',
        order_id: order.id,
        revenue: order.total,
        currency: order.currency_code,
        region_id: (order as any).region_id ?? null,
        item_count: order.items?.length ?? 0,
      },
    })
  } catch (error) {
    // Analytics must never break order processing.
    console.error('Error sending order analytics event:', error)
  } finally {
    try {
      await client?.shutdown()
    } catch {
      // Ignore flush errors on shutdown.
    }
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
