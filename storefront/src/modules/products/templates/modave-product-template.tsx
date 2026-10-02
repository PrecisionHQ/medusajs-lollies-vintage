import React, { Suspense } from "react"
import Link from "next/link"

import Context from "@/context/Context"
import TrackView from "@modules/common/components/track-view"
import Topbar3 from "@/components/headers/Topbar3"
import Header1 from "@/components/headers/Header1"
import Footer1 from "@/components/footers/Footer1"
import BundleSection from "@modules/products/components/bundle-section"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import ModaveDetailsClient from "@/components/productDetails/ModaveDetailsClient"
import ModaveDescriptionTabs from "@/components/productDetails/ModaveDescriptionTabs"
import ModaveRelatedProducts from "@/components/productDetails/ModaveRelatedProducts"
import CartModal from "@/components/modals/CartModal"
import QuickView from "@/components/modals/QuickView"
import Compare from "@/components/modals/Compare"
import MobileMenu from "@/components/modals/MobileMenu"
import SearchModal from "@/components/modals/SearchModal"
import Wishlist from "@/components/modals/Wishlist"
import SizeGuide from "@/components/modals/SizeGuide"
import ModaveScripts from "@/components/common/ModaveScripts"
import { retrieveCollection } from "@lib/data/collections"
import { buildLolliesMenu } from "@lib/util/lollies-menu"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

type ModaveProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

/**
 * Modave-styled product detail page (product-grid-1 theme) on live Medusa
 * data: breadcrumb, gallery + variant selection + real cart, description /
 * reviews / shipping tabs, related products.
 *
 * Lives OUTSIDE the `(main)` group like the homepage, so it keeps the
 * Modave Topbar3/Header1/Footer1 chrome instead of the Medusa starter
 * Nav/Footer. Cart/account/search pages keep the starter layout.
 */
async function ModaveBreadcrumb({
  product,
  countryCode,
}: {
  product: HttpTypes.StoreProduct
  countryCode: string
}) {
  let collection: HttpTypes.StoreCollection | null = null
  if (product.collection_id) {
    try {
      collection = await retrieveCollection(product.collection_id)
    } catch {
      collection = null
    }
  }
  const category = product.categories?.[0]
  const parent = category
    ? {
        name: category.name,
        href: `/${countryCode}/categories/${category.handle}`,
      }
    : collection
    ? {
        name: collection.title,
        href: `/${countryCode}/collections/${collection.handle}`,
      }
    : null

  return (
    <div className="tf-breadcrumb">
      <div className="container">
        <div className="tf-breadcrumb-wrap">
          <div className="tf-breadcrumb-list">
            <Link href={`/${countryCode}`} className="text text-caption-1">
              Homepage
            </Link>
            <i className="icon icon-arrRight" />
            {parent && (
              <>
                <Link href={parent.href} className="text text-caption-1">
                  {parent.name}
                </Link>
                <i className="icon icon-arrRight" />
              </>
            )}
            <span className="text text-caption-1">{product.title}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const ModaveProductTemplate: React.FC<ModaveProductTemplateProps> = ({
  product,
  region,
  countryCode,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const { menu, shopLinks, catLinks } = buildLolliesMenu(countryCode)

  return (
    <Context>
      <ModaveScripts />
      <div className="modave-scope">
        <Topbar3 />
        <Header1
          menu={menu}
          shopLinks={shopLinks}
          catLinks={catLinks}
          countryCode={countryCode}
        />
        <TrackView
          event="product_viewed"
          properties={{ product_id: product.id, handle: product.handle }}
        />
        <ModaveBreadcrumb product={product} countryCode={countryCode} />
        <ModaveDetailsClient
          product={product}
          region={region}
          countryCode={countryCode}
        />
        <ModaveDescriptionTabs product={product} />
        <div data-testid="related-products-container">
          <Suspense fallback={<SkeletonRelatedProducts />}>
            <ModaveRelatedProducts
              product={product}
              countryCode={countryCode}
            />
          </Suspense>
        </div>
        {product.id ? <BundleSection productId={product.id} /> : null}
        <Footer1 dark />
        <SizeGuide />
        <CartModal />
        <QuickView />
        <Compare />
        <MobileMenu menu={menu} shopLinks={shopLinks} catLinks={catLinks} />
        <SearchModal />
        <Wishlist />
      </div>
    </Context>
  )
}

export default ModaveProductTemplate
