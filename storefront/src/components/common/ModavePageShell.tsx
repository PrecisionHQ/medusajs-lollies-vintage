import Context from "@/context/Context"
import Topbar3 from "@/components/headers/Topbar3"
import Header1 from "@/components/headers/Header1"
import Footer1 from "@/components/footers/Footer1"
import ScrollTop from "@/components/common/ScrollTop"
import ModaveScripts from "@/components/common/ModaveScripts"
import CartModal from "@/components/modals/CartModal"
import QuickView from "@/components/modals/QuickView"
import Compare from "@/components/modals/Compare"
import MobileMenu from "@/components/modals/MobileMenu"
import SearchModal from "@/components/modals/SearchModal"
import NewsLetterModal from "@/components/modals/NewsLetterModal"
import Wishlist from "@/components/modals/Wishlist"
import { buildLolliesMenu } from "@lib/util/lollies-menu"

/**
 * Full Modave page shell for routes living outside the `(main)` group
 * (which carries the starter Nav/Footer): theme chrome + commerce modals
 * + Context, mirroring the homepage composition.
 */
export default function ModavePageShell({
  countryCode,
  children,
}: {
  countryCode: string
  children: React.ReactNode
}) {
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
        {children}
        <Footer1 dark />
        <ScrollTop />
        <CartModal />
        <QuickView />
        <Compare />
        <MobileMenu menu={menu} shopLinks={shopLinks} catLinks={catLinks} />
        <SearchModal />
        <NewsLetterModal products={[]} />
        <Wishlist />
      </div>
    </Context>
  )
}
