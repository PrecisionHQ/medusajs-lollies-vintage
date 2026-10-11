/**
 * Lollies header menu — single source of truth shared by the server
 * homepage (which builds it with the visitor's countryCode) and the client
 * Nav / MobileMenu (which derive countryCode from the URL when props are
 * absent). Pure module: no "use client", no data fetching.
 *
 * Routes are Medusa-canonical: /store, /collections/[handle],
 * /categories/[handle]. The merchandising handles below (bridal, new-in,
 * sale) are created by backend/scripts/import-shopify-collections.mjs.
 */

import { getLocale } from "@/i18n/config"
import { t } from "@/i18n/translate"

export type MenuLink = {
  key: string
  label: string
  href: string
  dropdown?: boolean
}

export type ShopLink = {
  label: string
  href: string
}

export type LolliesMenu = {
  menu: MenuLink[]
  shopLinks: ShopLink[]
  catLinks: ShopLink[]
}

/**
 * Category handles created by backend/scripts/import-shopify-collections.mjs
 * (--cats). Kept here (not fetched) so client Nav/MobileMenu can fall back
 * to URL-derived defaults without a server round-trip.
 */
const CATEGORY_TILES: { label: string; handle: string }[] = [
  { label: "Dresses", handle: "dresses" },
  { label: "Maxi Dresses", handle: "maxi-dresses" },
  { label: "Mini & Midi Dresses", handle: "mini-midi-dresses" },
  { label: "Satin Dresses", handle: "satin-dresses" },
  { label: "Curve", handle: "curve" },
  { label: "Jumpsuits & Playsuits", handle: "jumpsuits-playsuits" },
  { label: "Co-ord Sets", handle: "coord-sets" },
  { label: "Skirts", handle: "skirts" },
  { label: "Shorts", handle: "shorts" },
  { label: "Tops & Jackets", handle: "tops-jackets" },
  { label: "Signature Edition", handle: "signature-edit" },
]

export function buildLolliesMenu(countryCode: string): LolliesMenu {
  const cc = countryCode || "gb"
  // Top-level labels are UI chrome (translated); collection/category
  // mirrors below stay English to match their destination page titles.
  const locale = getLocale(cc)
  return {
    menu: [
      { key: "home", label: t(locale, "nav.home"), href: `/${cc}` },
      { key: "shop", label: t(locale, "nav.shopAll"), href: `/${cc}/store`, dropdown: true },
      { key: "sales", label: t(locale, "nav.sales"), href: `/${cc}/categories/sale` },
      { key: "bridal", label: t(locale, "nav.bridal"), href: `/${cc}/collections/bridal` },
      { key: "new", label: t(locale, "nav.newIn"), href: `/${cc}/collections/new-in` },
    ],
    shopLinks: [
      { label: t(locale, "home.allProducts"), href: `/${cc}/store` },
      { label: "Trending", href: `/${cc}/collections/trending` },
      { label: "Bridal", href: `/${cc}/collections/bridal` },
      { label: "New In", href: `/${cc}/collections/new-in` },
      { label: "Sale", href: `/${cc}/categories/sale` },
      { label: t(locale, "listing.newestFirst"), href: `/${cc}/store?sortBy=created_at` },
    ],
    catLinks: CATEGORY_TILES.map((c) => ({
      label: c.label,
      href: `/${cc}/categories/${c.handle}`,
    })),
  }
}
