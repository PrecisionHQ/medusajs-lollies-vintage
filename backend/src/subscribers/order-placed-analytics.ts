import { PostHog } from 'posthog-node'
import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { POSTHOG_ENABLED, POSTHOG_HOST, POSTHOG_KEY } from '../lib/constants'
import {
  META_CAPI_ENABLED,
  META_CAPI_TOKEN,
  META_PIXEL_ID,
  META_TEST_EVENT_CODE,
} from '../lib/constants'
import { buildPurchasePayload, sendCapiEvents } from '../lib/meta-conversions'

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
  if (!POSTHOG_ENABLED && !META_CAPI_ENABLED) {
    return
  }

  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

  let client: PostHog | null = null
  try {
    const order = await orderModuleService.retrieveOrder(data.id, {
      relations: ['items'],
    })

    if (POSTHOG_ENABLED) {
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
    }

    // P6 — Meta Conversions API mirror. Same event_id as the browser
    // Purchase (order id) so Meta dedupes the pair. Inert without keys.
    if (META_CAPI_ENABLED) {
      const payload = buildPurchasePayload(
        {
          id: order.id,
          email: order.email,
          total: order.total,
          currency_code: order.currency_code,
          items: (order.items || []).map((i: any) => ({
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
        },
        META_TEST_EVENT_CODE
      )
      await sendCapiEvents(META_PIXEL_ID as string, META_CAPI_TOKEN as string, payload)
    }
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
