import { Button, Section, Text } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the NewsletterConfirmEmail template, used to identify it
 */
export const NEWSLETTER_CONFIRM = 'newsletter-confirm'

export interface NewsletterConfirmEmailProps {
  /** One-click confirmation link (random token, no login needed). */
  confirmLink: string
  shopLink: string
  storeName?: string
  preview?: string
}

export const isNewsletterConfirmData = (
  data: any
): data is NewsletterConfirmEmailProps =>
  typeof data?.confirmLink === 'string' && data.confirmLink.length > 0

/**
 * Double opt-in for the owned newsletter list. One click confirms; the
 * subscription row stays pending (unsendable-to) until then.
 */
export const NewsletterConfirmEmail = ({
  confirmLink,
  shopLink,
  storeName = process.env.STORE_NAME || 'your store',
  preview = 'Confirm your subscription',
}: NewsletterConfirmEmailProps) => (
  <Base preview={preview}>
    <Section className="text-center mt-[32px]">
      <Text className="text-black text-[18px] font-semibold leading-[28px]">
        One more click, please
      </Text>
      <Text className="text-black text-[14px] leading-[24px]">
        You asked to hear from {storeName}. Confirm below and you&apos;re on
        the list — drops, restocks and subscriber-only offers, never spam.
      </Text>
      <Section className="mt-4 mb-[16px]">
        <Button
          className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
          href={confirmLink}
        >
          Confirm my subscription
        </Button>
      </Section>
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        Didn&apos;t ask for this? Ignore this email — nothing is subscribed
        until you confirm. Or browse instead:{' '}
        <a href={shopLink} className="text-[#666666] underline">
          {storeName}
        </a>
      </Text>
    </Section>
  </Base>
)
