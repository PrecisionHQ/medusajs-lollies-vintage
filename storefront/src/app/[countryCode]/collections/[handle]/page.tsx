import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCollectionByHandle } from "@lib/data/collections"
import { getProductsListWithSort } from "@lib/data/products"
import { adaptMedusaProductsToModave } from "@lib/util/modave-product-adapter"
import ModaveListing from "@/components/common/ModaveListing"
import ModavePageShell from "@/components/common/ModavePageShell"
import TrackView from "@modules/common/components/track-view"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getStoreName } from "@lib/util/env"
import "@/app/modave-theme.css"

type Props = {
  params: Promise<{ handle: string; countryCode: string }>
  searchParams: Promise<{
    page?: string
    sortBy?: SortOptions
  }>
}

export const PRODUCT_LIMIT = 16

/**
 * Rendered per request rather than statically.
 *
 * Collections can be created in the admin at any time, so prerendering a
 * list captured at build time buys nothing — and the old static setup 500d
 * on every /collections/* URL on fresh deploys (DYNAMIC_SERVER_USAGE via
 * cookie access). New collections work immediately, no rebuild needed.
 */
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const collection = await getCollectionByHandle(handle)

  if (!collection) {
    notFound()
  }

  return {
    title: `${collection.title} | ${getStoreName()}`,
    description: `${collection.title} collection`,
  } as Metadata
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { handle, countryCode } = await params
  const { sortBy, page } = await searchParams

  const collection = await getCollectionByHandle(handle)
  if (!collection) {
    notFound()
  }

  const pageNumber = Math.max(parseInt(page || "1") || 1, 1)
  const sort = sortBy || "created_at"
  const {
    response: { products, count },
  } = await getProductsListWithSort({
    page: pageNumber,
    queryParams: { collection_id: [collection.id], limit: PRODUCT_LIMIT },
    sortBy: sort,
    countryCode,
  }).catch(() => ({ response: { products: [], count: 0 } }))
  const cards = adaptMedusaProductsToModave(products, countryCode)
  const basePath = `/${countryCode}/collections/${collection.handle}`

  return (
    <ModavePageShell countryCode={countryCode}>
      <TrackView
        event="collection_viewed"
        properties={{ collection_id: collection.id, handle: collection.handle }}
      />
      <ModaveListing
        title={collection.title}
        crumbs={[
          { label: "Homepage", href: `/${countryCode}` },
          { label: "Collections", href: `/${countryCode}/collections` },
          { label: collection.title },
        ]}
        cards={cards}
        sortBy={sort}
        page={pageNumber}
        totalPages={Math.max(Math.ceil(count / PRODUCT_LIMIT), 1)}
        basePath={basePath}
      />
    </ModavePageShell>
  )
}
