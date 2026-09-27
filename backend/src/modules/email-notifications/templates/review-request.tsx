import { Button, Hr, Link, Section, Text } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the ReviewRequestEmail template, used to identify it
 */
export const REVIEW_REQUEST = 'review-request'

export interface ReviewRequestEmailProps {
  /** First name or email, for a personal greeting. */
  name?: string | null
  /** Order display id, so the shopper knows which purchase this is about. */
  orderDisplayId?: string | number | null
  /** Product titles from the order (shown up to 5). */
  items?: string[]
  /** Link to the order / review entry point (per-product links land in PR-04). */
  reviewLink: string
  unsubscribeLink?: string
  storeName?: string
  preview?: string
}

export const isReviewRequestData = (data: any): data is ReviewRequestEmailProps =>
  typeof data?.reviewLink === 'string' && data.reviewLink.length > 0

/**
 * The ReviewRequestEmail template component built with react-email
 */
export const ReviewRequestEmail = ({
  name,
  orderDisplayId,
  items = [],
  reviewLink,
  unsubscribeLink,
  storeName = process.env.STORE_NAME || 'your store',
  preview = 'How was your order?',
}: ReviewRequestEmailProps) => (
  <Base preview={preview}>
    <Section className="text-center mt-[32px]">
      <Text className="text-black text-[18px] font-semibold leading-[28px]">
        How was your order{name ? `, ${name}` : ''}?
      </Text>
      <Text className="text-black text-[14px] leading-[24px]">
        {orderDisplayId ? <>Order #{orderDisplayId} was delivered. </> : null}
        {items.length ? (
          <>We&apos;d love to hear what you think of {items.slice(0, 3).join(', ')}{items.length > 3 ? ', and more' : ''}.</>
        ) : (
          <>We&apos;d love to hear what you think.</>
        )}
      </Text>
      <Section className="mt-4 mb-[16px]">
        <Button
          className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
          href={reviewLink}
        >
          Write a review
        </Button>
      </Section>
      <Text className="text-[#666666] text-[12px] leading-[20px]">
        Honest reviews help other shoppers — good or bad, we read every one.
      </Text>
    </Section>
    <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
    <Text className="text-[#666666] text-[12px] leading-[24px]">
      One email per order, that&apos;s it. {unsubscribeLink ? (
        <Link href={unsubscribeLink} className="text-[#666666] underline">
          Unsubscribe from marketing emails
        </Link>
      ) : null}
    </Text>
  </Base>
)
