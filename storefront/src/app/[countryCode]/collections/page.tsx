import { Metadata } from "next"
import Link from "next/link"

import ModavePageShell from "@/components/common/ModavePageShell"
import { TileCard } from "@/components/homes/fashion-elegantAbode/Categories"
import { getAllCollectionTiles } from "@/lib/data/listing-tiles"
import { getStoreName } from "@lib/util/env"
import "@/app/modave-theme.css"

export const metadata: Metadata = {
  title: `All Collections | ${getStoreName()}`,
  description: `Shop every collection at ${getStoreName()}.`,
}

/**
 * All Collections index — destination of the homepage "View All
 * Collection" link. Same Modave pattern as the listing pages (page-title
 * banner + breadcrumbs) with the same 4-across tile grid used by
 * "Shop by Category", so it never falls back to the Medusa starter
 * design. Rendered per request: new collections appear immediately.
 */
export const dynamic = "force-dynamic"

export default async function AllCollectionsPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const tiles = await getAllCollectionTiles(countryCode)

  return (
    <ModavePageShell countryCode={countryCode}>
      <div
        className="page-title"
        style={{
          backgroundImage: 'url("/modave/images/section/page-title.jpg")',
        }}
      >
        <div className="container">
          <h3 className="heading text-center">Collections</h3>
          <ul className="breadcrumbs d-flex align-items-center justify-content-center">
            <li>
              <Link href={`/${countryCode}`} className="link">
                Homepage
              </Link>
              <i className="icon icon-arrRight" />
            </li>
            <li>
              <span>Collections</span>
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
              <p>No collections found.</p>
            </div>
          )}
        </div>
      </section>
    </ModavePageShell>
  )
}
