import { Suspense } from "react"
import ModaveRelatedCarousel from "@/components/productDetails/ModaveRelatedCarousel"
import { getProductsList } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { adaptMedusaProductsToModave } from "@lib/util/modave-product-adapter"
import { HttpTypes } from "@medusajs/types"

/**
 * Related products in Modave card styling. Same sourcing logic as the
 * starter RelatedProducts (collection, then tags) but rendered through
 * the live-card adapter + ProductCard1 so cards link to real PDPs.
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

  const queryParams: HttpTypes.StoreProductListParams = {}
  if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  }
  const tagIds = product.tags?.map((t) => t.id).filter(Boolean) as
    | string[]
    | undefined
  if (tagIds?.length) {
    queryParams.tag_id = tagIds
  }

  const products = await getProductsList({ queryParams, countryCode }).then(
    ({ response }) =>
      response.products.filter((p) => p.id !== product.id).slice(0, 8)
  )
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
