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
 * Synchronously tear down every Bootstrap overlay (modal / offcanvas
 * backdrops, `modal-open` body lock). Next.js client-side navigation does
 * not run Bootstrap's hide path, so without this a nav away from inside an
 * open QuickView / search / compare / cart overlay leaves a stale backdrop
 * + `overflow: hidden` on the new page — the page looks fine but is
 * unclickable until a full refresh.
 *
 * Strategy is belt-and-braces: ask the Bootstrap instances to hide (so
 * internal state stays consistent for the next open), then sweep the DOM
 * synchronously so no backdrop survives even if the bundle is still
 * loading or a fade transition is mid-flight.
 */
export function dismissBootstrapOverlays(): void {
  if (typeof document === "undefined") {
    return
  }
  try {
    const open = Array.from(
      document.querySelectorAll(".modal.show, .offcanvas.show")
    )
    if (open.length) {
      loadBootstrap()
        .then((bs) => {
          try {
            for (const el of open) {
              const inst =
                bs?.Modal?.getInstance?.(el) ??
                bs?.Offcanvas?.getInstance?.(el)
              inst?.hide?.()
            }
          } catch {
            // DOM sweep below is the guarantee; instance hide is best-effort.
          }
        })
        .catch(() => {
          // Bundle failed to load — DOM sweep below still frees the page.
        })
    }
  } catch {
    // Never let overlay cleanup break navigation.
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
