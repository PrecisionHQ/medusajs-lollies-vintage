/**
 * Client-side Bootstrap singleton. The Modave theme drives modals,
 * offcanvas panels, dropdowns and collapses through `data-bs-toggle`
 * attributes (made live by ModaveScripts) but several components also open
 * Bootstrap UI programmatically — they must share ONE loaded bundle
 * instance instead of each importing it separately.
 */

let loaded: Promise<any> | null = null

export function loadBootstrap(): Promise<any> {
  if (!loaded) {
    loaded = import("bootstrap/dist/js/bootstrap.bundle.min.js")
  }
  return loaded
}
