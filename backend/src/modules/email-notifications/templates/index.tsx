import { ReactNode } from 'react'
import { MedusaError } from '@medusajs/framework/utils'
import { InviteUserEmail, INVITE_USER, isInviteUserData } from './invite-user'
import { OrderPlacedTemplate, ORDER_PLACED, isOrderPlacedTemplateData } from './order-placed'
import { ResetPasswordEmail, RESET_PASSWORD, isResetPasswordData } from './reset-password'
import { CartAbandonedEmail, CART_ABANDONED, isCartAbandonedData } from './cart-abandoned'
import { ReviewRequestEmail, REVIEW_REQUEST, isReviewRequestData } from './review-request'
import { WinbackEmail, WINBACK, isWinbackData } from './winback'
import { WelcomeEmail, WELCOME, isWelcomeData } from './welcome'
import { BackInStockEmail, BACK_IN_STOCK, isBackInStockData } from './back-in-stock'

export const EmailTemplates = {
  INVITE_USER,
  ORDER_PLACED,
  RESET_PASSWORD,
  CART_ABANDONED,
  REVIEW_REQUEST,
  WINBACK,
  WELCOME,
  BACK_IN_STOCK
} as const

export type EmailTemplateType = keyof typeof EmailTemplates

export function generateEmailTemplate(templateKey: string, data: unknown): ReactNode {
  switch (templateKey) {
    case EmailTemplates.INVITE_USER:
      if (!isInviteUserData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.INVITE_USER}"`
        )
      }
      return <InviteUserEmail {...data} />

    case EmailTemplates.ORDER_PLACED:
      if (!isOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ORDER_PLACED}"`
        )
      }
      return <OrderPlacedTemplate {...data} />

    case EmailTemplates.RESET_PASSWORD:
      if (!isResetPasswordData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.RESET_PASSWORD}"`
        )
      }
      return <ResetPasswordEmail {...data} />

    case EmailTemplates.CART_ABANDONED:
      if (!isCartAbandonedData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.CART_ABANDONED}"`
        )
      }
      return <CartAbandonedEmail {...data} />

    case EmailTemplates.REVIEW_REQUEST:
      if (!isReviewRequestData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.REVIEW_REQUEST}"`
        )
      }
      return <ReviewRequestEmail {...data} />

    case EmailTemplates.WINBACK:
      if (!isWinbackData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.WINBACK}"`
        )
      }
      return <WinbackEmail {...data} />

    case EmailTemplates.WELCOME:
      if (!isWelcomeData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.WELCOME}"`
        )
      }
      return <WelcomeEmail {...data} />

    case EmailTemplates.BACK_IN_STOCK:
      if (!isBackInStockData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.BACK_IN_STOCK}"`
        )
      }
      return <BackInStockEmail {...data} />

    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown template key: "${templateKey}"`
      )
  }
}

export { InviteUserEmail, OrderPlacedTemplate, ResetPasswordEmail, CartAbandonedEmail, ReviewRequestEmail, WinbackEmail, WelcomeEmail, BackInStockEmail }
