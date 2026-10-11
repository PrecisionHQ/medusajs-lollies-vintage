import { Metadata } from "next"
import { notFound } from "next/navigation"

import ProductTemplate from "@modules/products/templates/modave-product-template"
import "@/app/modave-theme.css"
import { getRegion, listRegions } from "@lib/data/regions"
import { getProductByHandle, getProductsList } from "@lib/data/products"
import { getStoreName } from "@lib/util/env"
import { stripHtmlToText } from "@lib/util/sanitize-html"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
}

/** Catalog freshness: re-render at most hourly so price/copy edits
 *  appear without a redeploy (on-demand webhook later). */
export const revalidate = 3600

export async function generateStaticParams() {
  const countryCodes = await listRegions().then(
    (regions) =>
      regions
        ?.map((r) => r.countries?.map((c) => c.iso_2))
        .flat()
        .filter(Boolean) as string[]
  )

  // generateStaticParams must return an array; returning null makes the build
  // fail rather than fall back to on-demand rendering.
  if (!countryCodes) {
    return []
  }

  const products = await Promise.all(
    countryCodes.map((countryCode) => {
      return getProductsList({ countryCode })
    })
  ).then((responses) =>
    responses.map(({ response }) => response.products).flat()
  )

  const staticParams = countryCodes
    ?.map((countryCode) =>
      products.map((product) => ({
        countryCode,
        handle: product.handle,
      }))
    )
    .flat()

  return staticParams
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, countryCode } = await params
  const region = await getRegion(countryCode)

  if (!region) {
    notFound()
  }

  const product = await getProductByHandle(handle, region.id)

  if (!product) {
    notFound()
  }

  return {
    title: `${product.title} | ${getStoreName()}`,
    description:
      stripHtmlToText(product.description || "").slice(0, 160) ||
      `Shop ${product.title} at ${getStoreName()}.`,
    alternates: {
      canonical: `/${countryCode}/products/${product.handle}`,
    },
    openGraph: {
      title: `${product.title} | ${getStoreName()}`,
      description:
        stripHtmlToText(product.description || "").slice(0, 160) || undefined,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { handle, countryCode } = await params
  const region = await getRegion(countryCode)

  if (!region) {
    notFound()
  }

  const pricedProduct = await getProductByHandle(handle, region.id)
  if (!pricedProduct) {
    notFound()
  }

  return (
    <ProductTemplate
      product={pricedProduct}
      region={region}
      countryCode={countryCode}
    />
  )
}
