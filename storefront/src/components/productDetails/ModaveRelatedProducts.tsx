import { Suspense } from "react"
import ModaveRelatedCarousel from "@/components/productDetails/ModaveRelatedCarousel"
import { getRegion } from "@lib/data/regions"
import { getRelatedProducts } from "@lib/util/recommendations"
import { adaptMedusaProductsToModave } from "@lib/util/modave-product-adapter"
import { HttpTypes } from "@medusajs/types"

/**
 * Related products in Modave card styling. P8-scored (same collection,
 * shared tags, curated boost) instead of the old single AND-query.
 */
async function RelatedCards({
  product,
  countryCode,
}: {
  product: HttpTypes.StoreProduct
  countryCode: string
}) {
  const region = await getRegion(countryCode)
  if (!region) return null

  const products = await getRelatedProducts(product, countryCode, 8)
  if (!products.length) return null

  const cards = adaptMedusaProductsToModave(products, countryCode)
  if (!cards.length) return null

  return (
    <>
      <div className="heading-section text-center wow fadeInUp">
        <h3 className="heading">Related Products</h3>
        <p className="subheading text-secondary">
          You might also want to check out these products.
        </p>
      </div>
      <ModaveRelatedCarousel cards={cards} />
    </>
  )
}

export default function ModaveRelatedProducts({
  product,
  countryCode,
}: {
  product: HttpTypes.StoreProduct
  countryCode: string
}) {
  return (
    <section className="flat-spacing">
      <div className="container flat-animate-tab">
        <Suspense fallback={null}>
          <RelatedCards product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </section>
  )
}
