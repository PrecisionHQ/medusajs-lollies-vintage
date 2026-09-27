import { Button, Hr, Link, Section, Text } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the WinbackEmail template, used to identify it
 */
export const WINBACK = 'winback'

export interface WinbackEmailProps {
  name?: string | null
  /** Static incentive code when the flow has one enabled. */
  incentiveCode?: string | null
  shopLink: string
  unsubscribeLink?: string
  storeName?: string
  preview?: string
}

export const isWinbackData = (data: any): data is WinbackEmailProps =>
  typeof data?.shopLink === 'string' && data.shopLink.length > 0

/**
 * The WinbackEmail template component built with react-email
 */
export const WinbackEmail = ({
  name,
  incentiveCode,
  shopLink,
  unsubscribeLink,
  storeName = process.env.STORE_NAME || 'your store',
  preview = 'We miss you',
}: WinbackEmailProps) => (
  <Base preview={preview}>
    <Section className="text-center mt-[32px]">
      <Text className="text-black text-[18px] font-semibold leading-[28px]">
        We miss you{name ? `, ${name}` : ''}
      </Text>
      <Text className="text-black text-[14px] leading-[24px]">
        It&apos;s been a while since your last {storeName} order. New vintage
        drops land every week — come have a look.
      </Text>
      {incentiveCode ? (
        <Text className="text-black text-[14px] leading-[24px]">
          Here&apos;s <strong>{incentiveCode}</strong> for 10% off your next order.
        </Text>
      ) : null}
      <Section className="mt-4 mb-[16px]">
        <Button
          className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
          href={shopLink}
        >
          Shop new arrivals
        </Button>
      </Section>
    </Section>
    <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
    <Text className="text-[#666666] text-[12px] leading-[24px]">
      {unsubscribeLink ? (
        <Link href={unsubscribeLink} className="text-[#666666] underline">
          Unsubscribe from marketing emails
        </Link>
      ) : null}
    </Text>
  </Base>
)
