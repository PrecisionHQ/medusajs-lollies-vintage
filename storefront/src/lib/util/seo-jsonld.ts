import type { HttpTypes } from "@medusajs/types"

/**
 * SEO structured-data builders (pure, server-safe). Emitted through the
 * <JsonLd> component; verified by grepping served HTML in tests.
 */

export type Breadcrumb = { label: string; href?: string }

const absolute = (base: string, href?: string | null): string | undefined => {
  if (!href) return undefined
  if (/^https?:\/\//i.test(href)) return href
  return `${base.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`
}

export function productJsonLd(opts: {
  product: HttpTypes.StoreProduct
  baseUrl: string
  path: string
  brand: string
  priceNumber: number | null
  currency?: string | null
  description: string
}): Record<string, unknown> {
  const { product, baseUrl, path, brand, priceNumber, currency, description } = opts
  const images = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...((product.images || [])
      .map((i: any) => i?.url)
      .filter(Boolean) as string[]),
  ].filter((u, i, arr) => arr.indexOf(u) === i)
  const purchasable = (product.variants || []).some(
    (v: any) =>
      !v.manage_inventory ||
      v.allow_backorder ||
      (v.inventory_quantity || 0) > 0
  )
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: images.length ? images : undefined,
    description: description || undefined,
    brand: { "@type": "Brand", name: brand },
    offers: {
      "@type": "Offer",
      url: absolute(baseUrl, path),
      priceCurrency: currency || undefined,
      price:
        priceNumber != null && Number.isFinite(priceNumber)
          ? priceNumber
          : undefined,
      availability:
        purchasable || !(product.variants || []).length
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  }
}

export function breadcrumbJsonLd(
  baseUrl: string,
  crumbs: Breadcrumb[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs
      .map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.label,
        ...(c.href ? { item: absolute(baseUrl, c.href) } : {}),
      }))
      .filter((item) => item.name),
  }
}

export function collectionJsonLd(opts: {
  title: string
  baseUrl: string
  path: string
  items: { title: string; href?: string }[]
}): Record<string, unknown> {
  const { title, baseUrl, path, items } = opts
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    url: absolute(baseUrl, path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.slice(0, 20).map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.title,
        ...(item.href ? { url: absolute(baseUrl, item.href) } : {}),
      })),
    },
  }
}

export function organizationJsonLd(opts: {
  storeName: string
  baseUrl: string
  logoUrl?: string
}): Record<string, unknown> {
  const { storeName, baseUrl, logoUrl } = opts
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: storeName,
        url: baseUrl.replace(/\/$/, ""),
        ...(logoUrl ? { logo: logoUrl } : {}),
      },
      {
        "@type": "WebSite",
        name: storeName,
        url: baseUrl.replace(/\/$/, ""),
      },
    ],
  }
}
