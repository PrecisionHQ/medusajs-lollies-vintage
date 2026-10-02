import { Metadata } from "next"

import ModaveListing from "@/components/common/ModaveListing"
import ModavePageShell from "@/components/common/ModavePageShell"
import SearchFacets, {
  FacetGroup,
} from "@modules/search/components/search-facets"
import TrackView from "@modules/common/components/track-view"
import { searchWithFacets } from "@modules/search/actions"
import { getProductsById } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getCollectionsList } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { sortProducts } from "@lib/util/sort-products"
import { adaptMedusaProductsToModave } from "@lib/util/modave-product-adapter"
import { splitOptionValues } from "@lib/util/search-facets"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import "@/app/modave-theme.css"

export const metadata: Metadata = {
  title: "Search",
  description: "Explore all of our products.",
}

type Params = {
  params: Promise<{ query: string; countryCode: string }>
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
    f_collection?: string | string[]
    f_category?: string | string[]
    f_color?: string | string[]
    f_size?: string | string[]
    f_tag?: string | string[]
  }>
}

export const PRODUCT_LIMIT = 16

const arr = (v?: string | string[]): string[] =>
  !v ? [] : Array.isArray(v) ? v : [v]

export default async function SearchResults({ params, searchParams }: Params) {
  const { query: rawQuery, countryCode } = await params
  const sp = await searchParams
  const query = decodeURI(rawQuery)
  const sort = sp.sortBy || "created_at"
  const pageNumber = Math.max(parseInt(sp.page || "1") || 1, 1)

  const filters = {
    collections: arr(sp.f_collection),
    categories: arr(sp.f_category),
    colors: arr(sp.f_color),
    sizes: arr(sp.f_size),
    tags: arr(sp.f_tag),
  }

  const [{ hits, facets }, region] = await Promise.all([
    searchWithFacets(query, filters).catch(() => ({ hits: [], facets: {} })),
    getRegion(countryCode),
  ])

  const ids = hits
    .map((h: any) => h.id)
    .filter((id): id is string => typeof id === "string")

  let cards: ReturnType<typeof adaptMedusaProductsToModave> = []
  let totalPages = 1
  if (ids.length && region) {
    const products =
      (await getProductsById({ ids, regionId: region.id }).catch(() => [])) ||
      []
    const sorted = sortProducts(products, sort)
    totalPages = Math.max(Math.ceil(sorted.length / PRODUCT_LIMIT), 1)
    const pageItems = sorted.slice(
      (pageNumber - 1) * PRODUCT_LIMIT,
      pageNumber * PRODUCT_LIMIT
    )
    cards = adaptMedusaProductsToModave(pageItems, countryCode)
  }

  // Display names for handle-facets (cached data calls).
  const [catList, colList] = await Promise.all([
    listCategories().catch(() => null),
    getCollectionsList(0, 100).catch(() => ({ collections: [] })),
  ])
  const catNames = new Map(
    (catList || []).map((c: any) => [c.handle, c.name || c.handle])
  )
  const colNames = new Map(
    (colList?.collections || []).map((c: any) => [c.handle, c.title || c.handle])
  )

  const fx = (facets || {}) as Record<string, Record<string, number>>
  const facetVals = (attr: string): string[] =>
    Object.keys(fx[attr] || {}).sort((a, b) => a.localeCompare(b))
  const { colors, sizes } = splitOptionValues(
    facetVals("variants.options.value")
  )

  const basePath = `/${countryCode}/results/${rawQuery}`
  const persist: Record<string, string | string[]> = { sortBy: sort }
  if (filters.collections.length)
    persist.f_collection = filters.collections
  if (filters.categories.length) persist.f_category = filters.categories
  if (filters.colors.length) persist.f_color = filters.colors
  if (filters.sizes.length) persist.f_size = filters.sizes
  if (filters.tags.length) persist.f_tag = filters.tags

  const groups: FacetGroup[] = [
    {
      key: "collection",
      title: "Collection",
      param: "f_collection",
      values: facetVals("collection.handle").map((h) => ({
        value: h,
        label: colNames.get(h) || h,
      })),
      active: filters.collections,
      basePath,
      persist,
    },
    {
      key: "category",
      title: "Category",
      param: "f_category",
      values: facetVals("categories.handle").map((h) => ({
        value: h,
        label: catNames.get(h) || h,
      })),
      active: filters.categories,
      basePath,
      persist,
    },
    {
      key: "style",
      title: "Style",
      param: "f_tag",
      values: facetVals("tags.value").map((v) => ({ value: v, label: v })),
      active: filters.tags,
      basePath,
      persist,
    },
    {
      key: "color",
      title: "Colour",
      param: "f_color",
      values: colors.map((v) => ({ value: v, label: v })),
      active: filters.colors,
      basePath,
      persist,
    },
    {
      key: "size",
      title: "Size",
      param: "f_size",
      values: sizes.map((v) => ({ value: v, label: v })),
      active: filters.sizes,
      basePath,
      persist,
    },
  ]

  const hasActiveFilter = Object.values(filters).some((v) => v.length > 0)

  return (
    <ModavePageShell countryCode={countryCode}>
      <TrackView
        event="search_performed"
        properties={{ query, result_count: ids.length }}
      />
      <ModaveListing
        title={`Results for "${query}"`}
        crumbs={[
          { label: "Homepage", href: `/${countryCode}` },
          { label: `Search: ${query}` },
        ]}
        cards={cards}
        sortBy={sort}
        page={pageNumber}
        totalPages={totalPages}
        basePath={basePath}
        extraParams={persist}
        sidebar={
          <>
            <SearchFacets groups={groups} />
            {hasActiveFilter && (
              <div className="mt-3">
                <a
                  href={basePath}
                  className="btn-line py_8"
                >
                  Clear all filters
                </a>
              </div>
            )}
          </>
        }
      />
    </ModavePageShell>
  )
}
