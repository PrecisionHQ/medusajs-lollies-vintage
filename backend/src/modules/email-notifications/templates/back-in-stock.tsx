import { Button, Hr, Link, Section, Text } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the BackInStockEmail template, used to identify it
 */
export const BACK_IN_STOCK = 'back-in-stock'

export interface BackInStockEmailProps {
  productTitle: string
  variantTitle?: string | null
  productLink: string
  unsubscribeLink?: string
  storeName?: string
  preview?: string
}

export const isBackInStockData = (data: any): data is BackInStockEmailProps =>
  typeof data?.productTitle === 'string' &&
  data.productTitle.length > 0 &&
  typeof data?.productLink === 'string' &&
  data.productLink.length > 0

/**
 * The BackInStockEmail template component built with react-email
 */
export const BackInStockEmail = ({
  productTitle,
  variantTitle,
  productLink,
  unsubscribeLink,
  storeName = process.env.STORE_NAME || 'your store',
  preview = 'Back in stock',
}: BackInStockEmailProps) => (
  <Base preview={preview}>
    <Section className="text-center mt-[32px]">
      <Text className="text-black text-[18px] font-semibold leading-[28px]">
        Good news — it&apos;s back
      </Text>
      <Text className="text-black text-[14px] leading-[24px]">
        {productTitle}
        {variantTitle ? ` (${variantTitle})` : ''} is available again at{' '}
        {storeName}. Stock is limited, so don&apos;t wait too long.
      </Text>
      <Section className="mt-4 mb-[16px]">
        <Button
          className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
          href={productLink}
        >
          Shop now
        </Button>
      </Section>
    </Section>
    <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
    <Text className="text-[#666666] text-[12px] leading-[24px]">
      You asked us to tell you about this. {unsubscribeLink ? (
        <Link href={unsubscribeLink} className="text-[#666666] underline">
          Unsubscribe from stock alerts
        </Link>
      ) : null}
    </Text>
  </Base>
)
