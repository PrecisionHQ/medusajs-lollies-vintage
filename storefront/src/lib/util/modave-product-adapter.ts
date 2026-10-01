import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "./get-product-price"

/**
 * Shape the Modave card components (`ProductCard1`, `LookbookProduct`, …)
 * understand. The static mock data in `src/data/products.js` uses this form:
 * numeric/string `id`, `title`, numeric `price`, `imgSrc` / `imgHover`.
 *
 * Live Medusa products are adapted into this shape so the preview sections
 * can render real catalogue data without rewriting every card. Two extra
 * optional fields carry the Medusa wiring:
 * - `href` — link to the real PDP (`/<countryCode>/products/<handle>`)
 * - `priceDisplay` — locale-formatted price (correct currency; the cards
 *   otherwise hardcode a `$` prefix)
 */
export type ModaveCardProduct = {
  id: string
  medusaId: string
  handle: string
  title: string
  price: number
  priceDisplay?: string
  currencyCode?: string
  imgSrc: string
  imgHover: string
  href?: string
}

const FALLBACK_IMG = "/modave/images/products/womens/women-19.jpg"

function pickImage(product: HttpTypes.StoreProduct): {
  imgSrc: string
  imgHover: string
} {
  const images = (product.images ?? [])
    .map((img: any) => img?.url)
    .filter(Boolean) as string[]
  const thumbnail = product.thumbnail || images[0] || FALLBACK_IMG
  const hover = images[1] || images[0] || thumbnail
  return { imgSrc: thumbnail, imgHover: hover }
}

export function adaptMedusaProductToModave(
  product: HttpTypes.StoreProduct,
  countryCode: string = "gb"
): ModaveCardProduct | null {
  if (!product?.id || !product?.handle) {
    return null
  }

  const { imgSrc, imgHover } = pickImage(product)

  let price = 0
  let priceDisplay: string | undefined
  let currencyCode: string | undefined
  try {
    const { cheapestPrice } = getProductPrice({ product })
    if (cheapestPrice) {
      price = cheapestPrice.calculated_price_number ?? 0
      priceDisplay = cheapestPrice.calculated_price
      currencyCode = cheapestPrice.currency_code
    }
  } catch {
    // No variants / no calculated price (e.g. draft product): keep the
    // title + image so the section still renders instead of dropping it.
  }

  return {
    id: product.handle,
    medusaId: product.id,
    handle: product.handle,
    title: product.title ?? product.handle,
    price,
    priceDisplay,
    currencyCode,
    imgSrc,
    imgHover,
    href: `/${countryCode}/products/${product.handle}`,
  }
}

export function adaptMedusaProductsToModave(
  products: HttpTypes.StoreProduct[] | null | undefined,
  countryCode: string = "gb"
): ModaveCardProduct[] {
  if (!products?.length) {
    return []
  }
  return products
    .map((p) => adaptMedusaProductToModave(p, countryCode))
    .filter((p): p is ModaveCardProduct => p !== null)
}
