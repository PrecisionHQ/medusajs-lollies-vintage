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
import CartModal from "@/components/modals/CartModal"
import QuickView from "@/components/modals/QuickView"
import QuickAdd from "@/components/modals/QuickAdd"
import Compare from "@/components/modals/Compare"
import MobileMenu from "@/components/modals/MobileMenu"
import SearchModal from "@/components/modals/SearchModal"
import Wishlist from "@/components/modals/Wishlist"
import { getProductsList, getProductsById } from "@/lib/data/products"
import { getRegion } from "@/lib/data/regions"
import { getCollectionByHandle } from "@/lib/data/collections"
import { getCategoryByHandle } from "@/lib/data/categories"
import { adaptMedusaProductsToModave } from "@/lib/util/modave-product-adapter"
import { buildLolliesMenu } from "@/lib/util/lollies-menu"
import { getStoreName } from "@/lib/util/env"
import { collectionData } from "@/data/collections"
import { topPicks as curatedTopPicks } from "@/data/curated"

import "./modave.css"

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
type Tile = {
  id: string
  title: string
  href: string
  imageSrc: string
}

// Tiles for the two merchandising rows. Collections row first (curated
// drops), then garment categories (≥5 live products), then Shop All.
type TileSpec =
  | { kind: "collection"; handle: string; title: string }
  | { kind: "category"; handle: string; title: string; minCount?: number }

const COLLECTION_TILES: TileSpec[] = [
  { kind: "collection", handle: "trending", title: "Trending" },
  { kind: "collection", handle: "bridal", title: "Bridal" },
  { kind: "category", handle: "sale", title: "Sale" },
  { kind: "collection", handle: "new-in", title: "New In" },
]

const CATEGORY_TILES: TileSpec[] = [
  { kind: "category", handle: "dresses", title: "Dresses" },
  { kind: "category", handle: "maxi-dresses", title: "Maxi Dresses" },
  { kind: "category", handle: "mini-midi-dresses", title: "Mini & Midi Dresses" },
  { kind: "category", handle: "satin-dresses", title: "Satin Dresses" },
  { kind: "category", handle: "curve", title: "Curve" },
  { kind: "category", handle: "jumpsuits-playsuits", title: "Jumpsuits & Playsuits" },
  { kind: "category", handle: "coord-sets", title: "Co-ord Sets", minCount: 1 },
  { kind: "category", handle: "signature-edit", title: "Signature Edition" },
]

async function fetchTile(
  spec: TileSpec,
  countryCode: string,
  fallbackIdx: number
): Promise<Tile | null> {
  try {
    const ref =
      spec.kind === "collection"
        ? await getCollectionByHandle(spec.handle)
        : (await getCategoryByHandle([spec.handle])).product_categories?.[0]
    if (!ref) return null
    const base = `/${countryCode}/${
      spec.kind === "collection" ? "collections" : "categories"
    }/${spec.handle}`
    const { response } = await getProductsList({
      queryParams: {
        ...(spec.kind === "collection"
          ? { collection_id: [ref.id] }
          : { category_id: [(ref as { id: string }).id] }),
        limit: 1,
      },
      countryCode,
    })
    const minCount = "minCount" in spec ? spec.minCount ?? 0 : 0
    if (response.count < minCount) return null
    const curatedKey = `${
      spec.kind === "collection" ? "collections" : "categories"
    }/${spec.handle}`
    return {
      id: ref.id,
      title: spec.title,
      href: base,
      imageSrc:
        CURATED_TILE_IMAGES[curatedKey] ||
        tileImage(response.products[0]?.thumbnail, fallbackIdx),
    }
  } catch {
    return null
  }
}

async function getTiles(
  countryCode: string,
  totalProducts: number,
  shopAllImage?: string
): Promise<{ collectionTiles: Tile[]; categoryTiles: Tile[] }> {  const [collectionTiles, categoryTiles] = await Promise.all([
    Promise.all(
      COLLECTION_TILES.map((spec, i) => fetchTile(spec, countryCode, i))
    ).then((ts) => ts.filter((t): t is Tile => t !== null)),
    Promise.all(
      CATEGORY_TILES.map((spec, i) =>
        fetchTile({ minCount: 5, ...spec } as TileSpec, countryCode, i)
      )
    ).then((ts) => ts.filter((t): t is Tile => t !== null)),
  ])
  if (totalProducts > 0) {
    const { response } = await getProductsList({
      queryParams: { limit: 1 },
      countryCode,
    }).catch(() => ({ response: { products: [], count: totalProducts } }))
    collectionTiles.push({
      id: "all",
      title: "Shop All",
      href: `/${countryCode}/store`,
      // First curated pick when available — never the seed-product default.
      imageSrc: shopAllImage || tileImage(response.products[0]?.thumbnail, 3),
    })
  }
  return { collectionTiles, categoryTiles }
}

// Sale product thumbnails for the countdown banner collage.
async function getSaleImages(
  countryCode: string,
  limit = 6
): Promise<string[]> {
  try {
    const sale = await getCategoryByHandle(["sale"])
    const id = sale.product_categories?.[0]?.id
    if (!id) return []
    const { response } = await getProductsList({
      queryParams: { category_id: [id], limit },
      countryCode,
    })
    return response.products
      .map((p: { thumbnail?: string | null }) => p.thumbnail)
      .filter((t): t is string => !!t)
  } catch {
    return []
  }
}

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

const tileImage = (thumb: string | null | undefined, fallbackIdx: number) =>
  thumb || collectionData[fallbackIdx % collectionData.length].imageSrc

// Curated tile artwork overrides the automatic first-product thumbnail.
// Bridal + Sale use their Shopify editorial images; every other tile shows
// its first live product (the representative pick — swap the entry here to
// change it, no code changes needed).
const CURATED_TILE_IMAGES: Record<string, string> = {
  "collections/bridal":
    "https://cdn.shopify.com/s/files/1/0054/6940/5295/collections/PhotoGrid-1647107497974.jpg?v=1679834661",
  "categories/sale":
    "https://cdn.shopify.com/s/files/1/0054/6940/5295/products/maya-petite-bridesmaid-v-neck-maxi-tulle-dress-with-tonal-delicate-sequin-in-navy.jpg?v=1638320659",
}



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
        <Categories liveItems={collectionTiles} />
        <Categories
          liveItems={categoryTiles}
          title="Shop by Category"
          layout="grid"
        />
        <Products liveItems={topPicks} />
        <BannerCountdown countryCode={countryCode} images={saleImages} />
        <MarqueeSection2 parentClass="tf-marquee marquee-white bg-purple-2" />
        <Lookbook liveItems={picksSource} />
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
        <Wishlist />
      </div>
    </Context>
  )
}
