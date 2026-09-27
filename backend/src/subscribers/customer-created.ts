import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { RESEND_FROM_EMAIL, STOREFRONT_URL } from '../lib/constants'
import { buildUnsubscribeLink } from '../modules/marketing/utils'
import {
  alreadySent,
  claimSend,
  isOptedOut,
  recentlyEmailed,
} from '../modules/marketing/flow-guards'

export const WELCOME_KEY = 'welcome';

/**
 * PR-03 — Welcome email on signup.
 *
 * Fires on `customer.created` (storefront registration). The 10% incentive is
 * a STATIC code from the welcome FlowConfig row — the merchant creates the
 * matching promotion in Admin > Promotions; this code only prints the string.
 * Guards: opt-out, 3-day cap, idempotency on the customer id.
 */
export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerModuleService = container.resolve(Modules.CUSTOMER)
  const notificationModuleService: INotificationModuleService =
    container.resolve(Modules.NOTIFICATION)
  const marketing = container.resolve('marketing') as any

  try {
    const customer = await customerModuleService.retrieveCustomer(data.id)
    if (!customer?.email) {
      return
    }
    const email = customer.email.trim().toLowerCase()

    let configs = await marketing.listFlowConfigs({ key: WELCOME_KEY })
    if (!configs.length) {
      ;[configs] = [
        await marketing.createFlowConfigs({
          key: WELCOME_KEY,
          enabled: true,
          delay_hours: 0,
          second_delay_hours: 0,
          second_enabled: false,
          incentive_enabled: true,
          incentive_code: 'WELCOME10',
        }),
      ]
    }
    const config = configs[0]
    if (!config.enabled) {
      return
    }

    if (
      (await alreadySent(marketing, 'welcome', customer.id)) ||
      (await isOptedOut(marketing, email)) ||
      (await recentlyEmailed(marketing, email))
    ) {
      return
    }

    await claimSend(marketing, 'welcome', customer.id, email)
    await notificationModuleService.createNotifications({
      to: email,
      channel: 'email',
      template: EmailTemplates.WELCOME,
      data: {
        emailOptions: {
          replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
          subject: 'Welcome — here’s 10% off your first order',
        },
        name: (customer as any).first_name ?? null,
        incentiveCode: config.incentive_enabled ? config.incentive_code : null,
        shopLink: STOREFRONT_URL.replace(/\/$/, ''),
        unsubscribeLink: buildUnsubscribeLink(email),
        preview: 'Welcome in',
      },
    })
  } catch (error) {
    console.error('Error sending welcome notification:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'customer.created',
}
