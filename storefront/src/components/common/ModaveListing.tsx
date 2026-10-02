import Link from "next/link"
import ProductCard1 from "@/components/productCards/ProductCard1"
import { ModaveCardProduct } from "@lib/util/modave-product-adapter"

export type Crumb = { label: string; href?: string }

const SORTS = [
  { value: "created_at", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
]

function pageHref(
  basePath: string,
  page: number,
  sortBy?: string,
  currentSort?: string,
  extra?: Record<string, string | string[]>
) {
  const params = new URLSearchParams()
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      for (const val of Array.isArray(v) ? v : [v]) {
        if (val) params.append(k, val)
      }
    }
  }
  if (page > 1) params.set("page", String(page))
  const sort = sortBy ?? currentSort
  if (sort && sort !== "created_at") params.set("sortBy", sort)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * Modave listing page (shop-collection inspiration): page-title banner with
 * breadcrumbs, sort links, live product-card grid, numbered pagination.
 * Server-rendered; sort/pagination are plain links (no JS needed).
 */
export default function ModaveListing({
  title,
  subtitle,
  crumbs,
  cards,
  sortBy = "created_at",
  page = 1,
  totalPages = 1,
  basePath,
  extraParams,
  sidebar,
}: {
  title: string
  subtitle?: string | null
  crumbs: Crumb[]
  cards: ModaveCardProduct[]
  sortBy?: string
  page?: number
  totalPages?: number
  basePath: string
  extraParams?: Record<string, string | string[]>
  sidebar?: React.ReactNode
}) {
  return (
    <>
      <div
        className="page-title"
        style={{
          backgroundImage: 'url("/modave/images/section/page-title.jpg")',
        }}
      >
        <div className="container">
          <h3 className="heading text-center">{title}</h3>
          <ul className="breadcrumbs d-flex align-items-center justify-content-center">
            {crumbs.map((c, i) => (
              <li key={i}>
                {c.href ? (
                  <Link href={c.href} className="link">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && (
                  <i className="icon icon-arrRight" />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <section className="flat-spacing">
        <div className="container">
          {subtitle ? <p className="text-secondary mb-4">{subtitle}</p> : null}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div className="d-flex gap-2 flex-wrap">
              {SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={pageHref(basePath, 1, s.value, undefined, extraParams)}
                  className={`btn-line py_8 ${
                    (sortBy || "created_at") === s.value ? "active" : ""
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
          <div className={sidebar ? "row" : ""}>
            {sidebar ? (
              <div className="col-lg-3 mb-4">
                {sidebar}
              </div>
            ) : null}
            <div className={sidebar ? "col-lg-9" : ""}>
          {cards.length ? (
            <div className="tf-grid-layout tf-col-2 lg-col-3 xl-col-4">
              {cards.map((card) => (
                <ProductCard1 key={card.id} product={card} />
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p>No products found in {title}.</p>
            </div>
          )}
          {totalPages > 1 && (
            <ul className="pagination-list d-flex justify-content-center gap-2 mt-5">
              {page > 1 && (
                <li>
                  <Link
                    className="pagination-item text-button"
                    href={pageHref(basePath, page - 1, undefined, sortBy, extraParams)}
                    aria-label="Previous page"
                  >
                    <i className="icon-arrLeft" />
                  </Link>
                </li>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
                )
                .map((p) => (
                  <li key={p} className={p === page ? "active" : ""}>
                    <Link
                      className="pagination-item text-button"
                      href={pageHref(basePath, p, undefined, sortBy, extraParams)}
                    >
                      {p}
                    </Link>
                  </li>
                ))}
              {page < totalPages && (
                <li>
                  <Link
                    className="pagination-item text-button"
                    href={pageHref(basePath, page + 1, undefined, sortBy, extraParams)}
                    aria-label="Next page"
                  >
                    <i className="icon-arrRight" />
                  </Link>
                </li>
              )}
            </ul>
          )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
