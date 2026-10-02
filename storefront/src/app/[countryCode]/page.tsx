import { Metadata } from "next"

import Context from "@/context/Context"
import Topbar3 from "@/components/headers/Topbar3"
import Header1 from "@/components/headers/Header1"
import Footer1 from "@/components/footers/Footer1"
import MarqueeSection2 from "@/components/common/MarqueeSection2"
import Products2 from "@/components/common/Products2"
import Testimonials from "@/components/common/Testimonials"
import BannerCountdown from "@/components/homes/fashion-elegantAbode/BannerCountdown"
import Categories from "@/components/homes/fashion-elegantAbode/Categories"
import Hero from "@/components/homes/fashion-elegantAbode/Hero"
import Lookbook from "@/components/homes/fashion-elegantAbode/Lookbook"
import Products from "@/components/homes/fashion-elegantAbode/Products"
import Features from "@/components/common/Features"
import Brands from "@/components/common/Brands"
import ScrollTop from "@/components/common/ScrollTop"
import ModaveScripts from "@/components/common/ModaveScripts"
import CartModal from "@/components/modals/CartModal"
import QuickView from "@/components/modals/QuickView"
import QuickAdd from "@/components/modals/QuickAdd"
import Compare from "@/components/modals/Compare"
import MobileMenu from "@/components/modals/MobileMenu"
import SearchModal from "@/components/modals/SearchModal"
import NewsLetterModal from "@/components/modals/NewsLetterModal"
import Wishlist from "@/components/modals/Wishlist"
import { getProductsList, getProductsById } from "@/lib/data/products"
import { getRegion } from "@/lib/data/regions"
import { getTiles, getSaleImages } from "@/lib/data/listing-tiles"
import { adaptMedusaProductsToModave } from "@/lib/util/modave-product-adapter"
import { buildLolliesMenu } from "@/lib/util/lollies-menu"
import { getStoreName } from "@/lib/util/env"
import { topPicks as curatedTopPicks } from "@/data/curated"

import "@/app/modave-theme.css"

export const metadata: Metadata = {
  title: getStoreName(),
  description: `Shop the latest at ${getStoreName()}.`,
}

/**
 * Lollies storefront homepage — Modave "Elegant Abode" theme on live
 * Medusa data. This REPLACES the old Medusa starter homepage (placeholder
 * Hero + LatestProducts), which lived in `(main)/page.tsx` and has been
 * deleted, and the standalone `/preview-elegant-abode` demo route, which
 * is also gone now that the real homepage carries the theme.
 *
 * Lives directly under `[countryCode]` (outside the `(main)` group) on
 * purpose: the `(main)` layout injects the Medusa starter Nav/Footer, and
 * rendering those alongside the Modave Topbar3/Header1/Footer1 would
 * double every piece of site chrome. Other routes (PDP, cart, search,
 * account, …) keep the Medusa layout untouched.
 *
 * Menu (Home, Shop All, Sales, Bridal, New In + category links) and tiles
 * (Explore Collections row, Shop by Category row) are built from live
 * merchandising data for the visitor's region. Sections fall back to
 * static demo content when the backend is unreachable so the page never
 * renders blank. No product counts are shown anywhere — inventory depth
 * stays private.
 */
async function getLiveCardProducts(countryCode: string) {
  try {
    const { response } = await getProductsList({
      queryParams: { limit: 8 },
      countryCode,
    })
    return {
      items: adaptMedusaProductsToModave(response.products, countryCode),
      total: response.count,
    }
  } catch {
    return { items: [], total: 0 }
  }
}

/**
 * Curated homepage picks in frontpage (merchant) order: first 4 feed
 * Today's Top Picks, the next 4 feed Top Trending. Null when the config is
 * empty or the fetch fails — the page then falls back to generic live
 * products (seed merch filtered out) and finally static demo data.
 */
async function getCuratedPicks(countryCode: string) {
  try {
    const ids: string[] = curatedTopPicks || []
    if (!ids.length) return null
    const region = await getRegion(countryCode)
    if (!region) return null
    const products = await getProductsById({ ids, regionId: region.id })
    const order = new Map(ids.map((id, i) => [id, i]))
    const sorted = [...(products || [])].sort(
      (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)
    )
    const items = adaptMedusaProductsToModave(sorted, countryCode)
    return items.length ? items : null
  } catch {
    return null
  }
}

// Seed merch must never headline the homepage, even on the fallback path.
const withoutSeeds = <T extends { title: string }>(items: T[]): T[] =>
  items.filter((p) => !p.title.startsWith("Medusa "))

export default async function Home({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const { menu, shopLinks, catLinks } = buildLolliesMenu(countryCode)
  const { items: liveItems, total: totalProducts } =
    await getLiveCardProducts(countryCode)
  // Curated frontpage picks (first 4 -> Top Picks, next 4 -> Trending).
  // Falls back to generic live products with seed merch filtered out, then
  // to static demo data inside the section components.
  const curatedItems = await getCuratedPicks(countryCode)
  const picksSource = curatedItems ?? withoutSeeds(liveItems)
  const topPicks = picksSource.slice(0, 4)
  const trending = picksSource.slice(4, 8)
  const { collectionTiles, categoryTiles } = await getTiles(
    countryCode,
    totalProducts,
    topPicks[0]?.imgSrc
  )
  const saleImages = await getSaleImages(countryCode)

  return (
    <Context>
      <ModaveScripts />
      <div className="modave-scope">
        <Topbar3 />
        <Header1
          menu={menu}
          shopLinks={shopLinks}
          catLinks={catLinks}
          recentProducts={topPicks}
          countryCode={countryCode}
        />
        <Hero />
        <Categories
          liveItems={collectionTiles}
          viewAllHref={`/${countryCode}/collections`}
        />
        <Categories
          liveItems={categoryTiles}
          title="Shop by Category"
          layout="grid"
          viewAllHref={`/${countryCode}/categories`}
          viewAllLabel="View All Categories"
        />
        <Products liveItems={topPicks} />
        <BannerCountdown countryCode={countryCode} images={saleImages} />
        <MarqueeSection2 parentClass="tf-marquee marquee-white bg-purple-2" />
        <Lookbook />
        <Products2
          title="Top Trending"
          parentClass="flat-spacing pt-0"
          liveItems={trending}
        />
        <Testimonials parentClass="testi-strip" />
        <Features parentClass="flat-spacing-5" />
        <Brands />
        <Footer1 dark />
        <ScrollTop />
        {/* Modave commerce modals (quick view / cart preview / wishlist).
            These are the static-demo versions; Medusa cart actions replace
            them in the full integration pass. Product cards link to the real
            Medusa PDPs, where purchase uses the real cart. */}
        <CartModal />
        <QuickView />
        <QuickAdd />
        <Compare />
        <MobileMenu menu={menu} shopLinks={shopLinks} catLinks={catLinks} />
        <SearchModal />
        <NewsLetterModal products={topPicks} />
        <Wishlist />
      </div>
    </Context>
  )
}
