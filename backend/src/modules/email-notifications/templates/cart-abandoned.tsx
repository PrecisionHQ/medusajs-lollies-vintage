import { Button, Hr, Link, Section, Text } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the CartAbandonedEmail template, used to identify it
 */
export const CART_ABANDONED = 'cart-abandoned'

export interface AbandonedCartItem {
  title: string
  quantity: number
  thumbnail?: string | null
  /** Line total in the smallest currency unit (cents), if known. */
  lineTotal?: number | null
}

/**
 * The props for the CartAbandonedEmail template
 */
export interface CartAbandonedEmailProps {
  items: AbandonedCartItem[]
  /** Cart subtotal in the smallest currency unit, if known. */
  subtotal?: number | null
  currencyCode?: string
  /** Storefront link that restores this exact cart. */
  recoveryLink: string
  /** One-click marketing unsubscribe for this recipient. */
  unsubscribeLink?: string
  /** Static incentive code (reminder #2 only, admin-toggled). */
  incentiveCode?: string | null
  storeName?: string
  preview?: string
}

export const isCartAbandonedData = (data: any): data is CartAbandonedEmailProps =>
  typeof data?.recoveryLink === 'string' &&
  data.recoveryLink.length > 0 &&
  Array.isArray(data?.items)

function formatAmount(amount: number | null | undefined, currencyCode?: string): string | null {
  if (amount == null) {
    return null
  }
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: (currencyCode ?? 'eur').toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${(amount / 100).toFixed(2)} ${(currencyCode ?? '').toUpperCase()}`
  }
}

/**
 * The CartAbandonedEmail template component built with react-email
 */
export const CartAbandonedEmail = ({
  items,
  subtotal,
  currencyCode,
  recoveryLink,
  unsubscribeLink,
  incentiveCode,
  storeName = process.env.STORE_NAME || 'your store',
  preview = 'You left something in your cart',
}: CartAbandonedEmailProps) => {
  const formattedSubtotal = formatAmount(subtotal, currencyCode)

  return (
    <Base preview={preview}>
      <Section className="text-center mt-[32px]">
        <Text className="text-black text-[18px] font-semibold leading-[28px]">
          Still thinking it over?
        </Text>
        <Text className="text-black text-[14px] leading-[24px]">
          Your cart at {storeName} is waiting — and it misses you.
        </Text>
      </Section>
      <Section className="mt-[16px]">
        {items.slice(0, 5).map((item, i) => (
          <Text key={i} className="text-black text-[14px] leading-[24px]">
            {item.quantity} × {item.title}
            {formatAmount(item.lineTotal, currencyCode)
              ? ` — ${formatAmount(item.lineTotal, currencyCode)}`
              : null}
          </Text>
        ))}
        {items.length > 5 ? (
          <Text className="text-[#666666] text-[12px] leading-[20px]">
            …and {items.length - 5} more item{items.length - 5 === 1 ? '' : 's'}.
          </Text>
        ) : null}
        {formattedSubtotal ? (
          <Text className="text-black text-[14px] font-semibold leading-[24px]">
            Subtotal: {formattedSubtotal}
          </Text>
        ) : null}
        {incentiveCode ? (
          <Text className="text-black text-[14px] leading-[24px]">
            Complete your order in the next 48 hours with code <strong>{incentiveCode}</strong> for
            10% off.
          </Text>
        ) : null}
        <Section className="text-center mt-4 mb-[16px]">
          <Button
            className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
            href={recoveryLink}
          >
            Return to your cart
          </Button>
        </Section>
      </Section>
      <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        You received this because you started a checkout at {storeName}.{' '}
        {unsubscribeLink ? (
          <Link href={unsubscribeLink} className="text-[#666666] underline">
            Unsubscribe from marketing emails
          </Link>
        ) : null}
      </Text>
    </Base>
  )
}
