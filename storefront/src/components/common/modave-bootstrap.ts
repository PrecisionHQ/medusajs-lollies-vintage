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

/**
 * Synchronously tear down every Bootstrap overlay. Next.js client-side
 * navigation does not run Bootstrap's hide path, so without this a nav
 * away from inside an open QuickView / search / compare / cart overlay
 * leaves the destination page unclickable until a full refresh.
 *
 * Live QA proved a backdrop-only sweep is NOT enough: the open modal
 * element itself (still carrying .show → display:block) survives inside
 * persistent layouts and keeps covering the new page. So this removes
 * .show from every open modal/offcanvas as well — the next data-bs-toggle
 * open re-shows cleanly through Bootstrap's own show() path.
 *
 * Strategy is belt-and-braces: force-hide in the DOM synchronously (the
 * guarantee), then ask the Bootstrap instances to hide too (keeps their
 * internal state consistent for the next open).
 */
export function dismissBootstrapOverlays(): void {
  if (typeof document === "undefined") {
    return
  }
  let open: Element[] = []
  try {
    open = Array.from(
      document.querySelectorAll(".modal.show, .offcanvas.show")
    )
  } catch {
    // Never let overlay cleanup break navigation.
  }
  for (const el of open) {
    el.classList.remove("show")
    ;(el as HTMLElement).style.display = "none"
    el.setAttribute("aria-hidden", "true")
  }
  if (open.length) {
    loadBootstrap()
      .then((bs) => {
        try {
          for (const el of open) {
            const inst =
              bs?.Modal?.getInstance?.(el) ??
              bs?.Offcanvas?.getInstance?.(el)
            inst?.hide?.()
            inst?.dispose?.()
          }
        } catch {
          // DOM sweep above is the guarantee; instance hide is best-effort.
        }
      })
      .catch(() => {
        // Bundle failed to load — DOM sweep above still frees the page.
      })
  }
  for (const backdrop of Array.from(
    document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop")
  )) {
    backdrop.remove()
  }
  document.body.classList.remove("modal-open")
  document.body.style.overflow = ""
  document.body.style.paddingRight = ""
  document.documentElement.style.overflow = ""
}
