import { Button, Hr, Img, Link, Section, Text } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the CampaignEmail template, used to identify it
 */
export const CAMPAIGN = 'campaign'

export interface CampaignProduct {
  title: string
  image?: string | null
  price?: string | null
  link: string
}

export interface CampaignEmailProps {
  headline: string
  body: string
  ctaLabel?: string
  ctaHref?: string
  products?: CampaignProduct[]
  shopLink: string
  unsubscribeLink?: string
  storeName?: string
  preview?: string
}

export const isCampaignData = (data: any): data is CampaignEmailProps =>
  typeof data?.headline === 'string' && data.headline.length > 0 &&
  typeof data?.body === 'string' &&
  typeof data?.shopLink === 'string' && data.shopLink.length > 0

const paragraphs = (body: string): string[] =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/**
 * P2 — Admin-composed campaign mail. Body is blank-line-separated
 * paragraphs; products render as compact rows when provided.
 */
export const CampaignEmail = ({
  headline,
  body,
  ctaLabel = 'Shop now',
  ctaHref = '/',
  products = [],
  shopLink,
  unsubscribeLink,
  storeName = process.env.STORE_NAME || 'your store',
  preview,
}: CampaignEmailProps) => (
  <Base preview={preview || headline}>
    <Section className="text-center mt-[32px]">
      <Text className="text-black text-[22px] font-semibold leading-[30px]">
        {headline}
      </Text>
      {paragraphs(body).map((p, i) => (
        <Text key={i} className="text-black text-[14px] leading-[24px]">
          {p}
        </Text>
      ))}
      {products.length > 0 && (
        <Section className="mt-[16px]">
          {products.slice(0, 4).map((p, i) => (
            <Section key={i} className="mb-[12px]">
              {p.image ? (
                <Img
                  src={p.image}
                  alt={p.title}
                  width="120"
                  className="rounded-[8px] mx-auto"
                />
              ) : null}
              <Text className="text-black text-[14px] font-semibold leading-[20px] mt-[8px] mb-0">
                <Link href={p.link} className="text-black no-underline">
                  {p.title}
                </Link>
              </Text>
              {p.price ? (
                <Text className="text-black text-[13px] leading-[18px] mt-0">
                  {p.price}
                </Text>
              ) : null}
            </Section>
          ))}
        </Section>
      )}
      <Section className="mt-4 mb-[16px]">
        <Button
          className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
          href={ctaHref}
        >
          {ctaLabel}
        </Button>
      </Section>
      <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        You received this because you subscribed at {storeName}.{' '}
        {unsubscribeLink ? (
          <Link href={unsubscribeLink} className="text-[#666666] underline">
            Unsubscribe from marketing emails
          </Link>
        ) : null}
      </Text>
    </Section>
  </Base>
)
