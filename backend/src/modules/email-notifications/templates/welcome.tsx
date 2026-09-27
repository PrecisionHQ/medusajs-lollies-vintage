import { Button, Hr, Link, Section, Text } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the WelcomeEmail template, used to identify it
 */
export const WELCOME = 'welcome'

export interface WelcomeEmailProps {
  name?: string | null
  /** Static welcome code (e.g. WELCOME10) — the merchant creates the matching
   * promotion in Admin; this template only prints the code. */
  incentiveCode?: string | null
  shopLink: string
  unsubscribeLink?: string
  storeName?: string
  preview?: string
}

export const isWelcomeData = (data: any): data is WelcomeEmailProps =>
  typeof data?.shopLink === 'string' && data.shopLink.length > 0

/**
 * The WelcomeEmail template component built with react-email
 */
export const WelcomeEmail = ({
  name,
  incentiveCode,
  shopLink,
  unsubscribeLink,
  storeName = process.env.STORE_NAME || 'your store',
  preview = 'Welcome in',
}: WelcomeEmailProps) => (
  <Base preview={preview}>
    <Section className="text-center mt-[32px]">
      <Text className="text-black text-[18px] font-semibold leading-[28px]">
        Welcome to {storeName}{name ? `, ${name}` : ''}
      </Text>
      <Text className="text-black text-[14px] leading-[24px]">
        Your account is ready. Here&apos;s what to do first: browse the latest
        drop and save your addresses for a faster checkout.
      </Text>
      {incentiveCode ? (
        <Text className="text-black text-[14px] leading-[24px]">
          Enjoy <strong>{incentiveCode}</strong> for 10% off your first order.
        </Text>
      ) : null}
      <Section className="mt-4 mb-[16px]">
        <Button
          className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
          href={shopLink}
        >
          Start shopping
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
