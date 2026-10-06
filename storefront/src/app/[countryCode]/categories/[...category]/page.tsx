import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listRegions } from "@lib/data/regions"
import { getProductsListWithSort } from "@lib/data/products"
import { adaptMedusaProductsToModave } from "@lib/util/modave-product-adapter"
import ModaveListing from "@/components/common/ModaveListing"
import ModavePageShell from "@/components/common/ModavePageShell"
import { StoreProductCategory, StoreRegion } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getStoreName } from "@lib/util/env"
import "@/app/modave-theme.css"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
}

export const PRODUCT_LIMIT = 16

/** Catalog freshness: re-render at most hourly so assortment edits
 *  appear without a redeploy (on-demand webhook later). */
export const revalidate = 3600

export async function generateStaticParams() {
  const product_categories = await listCategories()

  if (!product_categories) {
    return []
  }

  const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
    regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
  )

  const categoryHandles = product_categories.map(
    (category: any) => category.handle
  )

  return (
    countryCodes
      ?.map((countryCode: string | undefined) =>
        categoryHandles.map((handle: any) => ({
          countryCode,
          category: [handle],
        }))
      )
      .flat() ?? []
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params

  try {
    const { product_categories } = await getCategoryByHandle(category)

    const title = product_categories
      .map((category: StoreProductCategory) => category.name)
      .join(" | ")

    const description =
      product_categories[product_categories.length - 1].description ??
      `${title} category.`

    return {
      title: `${title} | ${getStoreName()}`,
      description,
      alternates: {
        canonical: `${category.join("/")}`,
      },
    }
  } catch (error) {
    notFound()
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category, countryCode } = await params
  const { sortBy, page } = await searchParams

  const { product_categories } = await getCategoryByHandle(category)

  if (!product_categories?.length) {
    notFound()
  }

  const current = product_categories[product_categories.length - 1]
  const parents = product_categories.slice(0, -1)
  const pageNumber = Math.max(parseInt(page || "1") || 1, 1)
  const sort = sortBy || "created_at"
  const {
    response: { products, count },
  } = await getProductsListWithSort({
    page: pageNumber,
    queryParams: { category_id: [current.id], limit: PRODUCT_LIMIT },
    sortBy: sort,
    countryCode,
  }).catch(() => ({ response: { products: [], count: 0 } }))
  const cards = adaptMedusaProductsToModave(products, countryCode)
  const basePath = `/${countryCode}/categories/${category.join("/")}`

  return (
    <ModavePageShell countryCode={countryCode}>
      <ModaveListing
        title={current.name}
        subtitle={current.description}
        crumbs={[
          { label: "Homepage", href: `/${countryCode}` },
          ...parents.map((p) => ({
            label: p.name,
            href: `/${countryCode}/categories/${p.handle}`,
          })),
          { label: current.name },
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
