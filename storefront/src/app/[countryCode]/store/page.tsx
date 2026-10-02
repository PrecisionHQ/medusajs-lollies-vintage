import { Metadata } from "next"

import { getProductsListWithSort } from "@lib/data/products"
import { adaptMedusaProductsToModave } from "@lib/util/modave-product-adapter"
import ModaveListing from "@/components/common/ModaveListing"
import ModavePageShell from "@/components/common/ModavePageShell"
import TrackView from "@modules/common/components/track-view"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getStoreName } from "@lib/util/env"
import "@/app/modave-theme.css"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{
    page?: string
    sortBy?: SortOptions
  }>
}

export const PRODUCT_LIMIT = 16

/**
 * Shop All — every product in the same Modave listing template as the
 * collection/category/search pages (banner, sort, 4-across grid,
 * pagination). Rendered per request so new products appear immediately.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `Shop All | ${getStoreName()}`,
  description: `Shop all products at ${getStoreName()}.`,
}

export default async function StorePage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const { sortBy, page } = await searchParams

  const pageNumber = Math.max(parseInt(page || "1") || 1, 1)
  const sort = sortBy || "created_at"
  const {
    response: { products, count },
  } = await getProductsListWithSort({
    page: pageNumber,
    queryParams: { limit: PRODUCT_LIMIT },
    sortBy: sort,
    countryCode,
  }).catch(() => ({ response: { products: [], count: 0 } }))
  const cards = adaptMedusaProductsToModave(products, countryCode)
  const basePath = `/${countryCode}/store`

  return (
    <ModavePageShell countryCode={countryCode}>
      <TrackView event="store_viewed" properties={{}} />
      <ModaveListing
        title="Shop All"
        crumbs={[{ label: "Homepage", href: `/${countryCode}` }, { label: "Shop All" }]}
        cards={cards}
        sortBy={sort}
        page={pageNumber}
        totalPages={Math.max(Math.ceil(count / PRODUCT_LIMIT), 1)}
        basePath={basePath}
      />
    </ModavePageShell>
  )
}
