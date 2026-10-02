import { getProductsList } from "@/lib/data/products"
import { getCollectionByHandle, getCollectionsList } from "@/lib/data/collections"
import { getCategoryByHandle, listCategories } from "@/lib/data/categories"
import { collectionData } from "@/data/collections"

/**
 * Shared merchandising-tile builders (homepage rows + All Collections /
 * All Categories index pages). Server-only: reads through the cached
 * Medusa data layer. Tiles deliberately carry no product counts —
 * inventory depth stays private.
 */
export type Tile = {
  id: string
  title: string
  href: string
  imageSrc: string
}

// Tiles for the merchandising rows. Collections row first (curated
// drops), then garment categories (≥5 live products), then Shop All.
export type TileSpec =
  | { kind: "collection"; handle: string; title: string }
  | { kind: "category"; handle: string; title: string; minCount?: number }

export const COLLECTION_TILES: TileSpec[] = [
  { kind: "collection", handle: "trending", title: "Trending" },
  { kind: "collection", handle: "bridal", title: "Bridal" },
  { kind: "category", handle: "sale", title: "Sale" },
  { kind: "collection", handle: "new-in", title: "New In" },
]

export const CATEGORY_TILES: TileSpec[] = [
  { kind: "category", handle: "dresses", title: "Dresses" },
  { kind: "category", handle: "maxi-dresses", title: "Maxi Dresses" },
  {
    kind: "category",
    handle: "mini-midi-dresses",
    title: "Mini & Midi Dresses",
  },
  { kind: "category", handle: "satin-dresses", title: "Satin Dresses" },
  { kind: "category", handle: "curve", title: "Curve" },
  {
    kind: "category",
    handle: "jumpsuits-playsuits",
    title: "Jumpsuits & Playsuits",
  },
  { kind: "category", handle: "coord-sets", title: "Co-ord Sets", minCount: 1 },
  { kind: "category", handle: "signature-edit", title: "Signature Edition" },
]

// Curated tile artwork overrides the automatic first-product thumbnail.
// Bridal uses its Shopify editorial image; Sale uses the MAYA dress;
// every other tile shows its first live product (swap the entry here to
// change it, no code changes needed).
export const CURATED_TILE_IMAGES: Record<string, string> = {
  "collections/bridal":
    "https://cdn.shopify.com/s/files/1/0054/6940/5295/collections/PhotoGrid-1647107497974.jpg?v=1679834661",
  "categories/sale":
    "https://cdn.shopify.com/s/files/1/0054/6940/5295/products/maya-petite-bridesmaid-v-neck-maxi-tulle-dress-with-tonal-delicate-sequin-in-navy.jpg?v=1638320659",
}

const tileImage = (thumb: string | null | undefined, fallbackIdx: number) =>
  thumb || collectionData[fallbackIdx % collectionData.length].imageSrc

export async function fetchTile(
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

export async function getTiles(
  countryCode: string,
  totalProducts: number,
  shopAllImage?: string
): Promise<{ collectionTiles: Tile[]; categoryTiles: Tile[] }> {
  const [collectionTiles, categoryTiles] = await Promise.all([
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
export async function getSaleImages(
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

// First-product thumbnail for one merch entity, or null when empty.
async function tileArtwork(
  countryCode: string,
  filter: { collection_id?: string[]; category_id?: string[] }
): Promise<{ imageSrc: string; count: number } | null> {
  try {
    const { response } = await getProductsList({
      queryParams: { ...filter, limit: 1 },
      countryCode,
    })
    if (!response.count) return null
    return { imageSrc: response.products[0]?.thumbnail || "", count: response.count }
  } catch {
    return null
  }
}

/**
 * All live collections as tiles for the /collections index page — same
 * Tile shape (and same artwork rules) as the homepage rows. Empty
 * collections are dropped so no tile dead-ends on "No products found".
 */
export async function getAllCollectionTiles(countryCode: string): Promise<Tile[]> {
  try {
    const { collections } = await getCollectionsList(0, 100)
    const tiles = await Promise.all(
      (collections || []).map(async (c, idx) => {
        const art = await tileArtwork(countryCode, { collection_id: [c.id] })
        if (!art) return null
        return {
          id: c.id,
          title: c.title,
          href: `/${countryCode}/collections/${c.handle}`,
          imageSrc: CURATED_TILE_IMAGES[`collections/${c.handle}`] || art.imageSrc || tileImage("", idx),
        } as Tile
      })
    )
    return tiles.filter((t): t is Tile => t !== null)
  } catch {
    return []
  }
}

/**
 * All live product categories (flattened, parents + children) as tiles
 * for the /categories index page. Same empty-drops rules as above.
 */
export async function getAllCategoryTiles(countryCode: string): Promise<Tile[]> {
  try {
    const roots = await listCategories()
    type Cat = { id: string; handle: string; name: string; category_children?: Cat[] }
    const flat: Cat[] = []
    const walk = (nodes: Cat[] | undefined) => {
      for (const n of nodes || []) {
        flat.push(n)
        walk(n.category_children)
      }
    }
    walk((roots as unknown as Cat[]) || [])
    const tiles = await Promise.all(
      flat.map(async (c, idx) => {
        const art = await tileArtwork(countryCode, { category_id: [c.id] })
        if (!art) return null
        return {
          id: c.id,
          title: c.name,
          href: `/${countryCode}/categories/${c.handle}`,
          imageSrc: CURATED_TILE_IMAGES[`categories/${c.handle}`] || art.imageSrc || tileImage("", idx),
        } as Tile
      })
    )
    return tiles.filter((t): t is Tile => t !== null)
  } catch {
    return []
  }
}
