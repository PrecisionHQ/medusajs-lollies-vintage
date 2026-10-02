import { Metadata } from "next"
import Link from "next/link"

import ModavePageShell from "@/components/common/ModavePageShell"
import { TileCard } from "@/components/homes/fashion-elegantAbode/Categories"
import { getAllCategoryTiles } from "@/lib/data/listing-tiles"
import { getStoreName } from "@lib/util/env"
import "@/app/modave-theme.css"

export const metadata: Metadata = {
  title: `All Categories | ${getStoreName()}`,
  description: `Shop every category at ${getStoreName()}.`,
}

/**
 * All Categories index — same Modave pattern as the collections index:
 * page-title banner + breadcrumbs + 4-across tile grid. Rendered per
 * request so admin-created categories appear without a rebuild.
 */
export const dynamic = "force-dynamic"

export default async function AllCategoriesPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const tiles = await getAllCategoryTiles(countryCode)

  return (
    <ModavePageShell countryCode={countryCode}>
      <div
        className="page-title"
        style={{
          backgroundImage: 'url("/modave/images/section/page-title.jpg")',
        }}
      >
        <div className="container">
          <h3 className="heading text-center">Categories</h3>
          <ul className="breadcrumbs d-flex align-items-center justify-content-center">
            <li>
              <Link href={`/${countryCode}`} className="link">
                Homepage
              </Link>
              <i className="icon icon-arrRight" />
            </li>
            <li>
              <span>Categories</span>
            </li>
          </ul>
        </div>
      </div>
      <section className="flat-spacing">
        <div className="container">
          {tiles.length ? (
            <div className="cat-grid">
              {tiles.map((item) => (
                <TileCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p>No categories found.</p>
            </div>
          )}
        </div>
      </section>
    </ModavePageShell>
  )
}
