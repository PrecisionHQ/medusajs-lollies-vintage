import { loadBootstrap } from "./modave-bootstrap"

/**
 * Open the live cart drawer after an add-to-cart, so the shopper lands on
 * the cart surface (same #shoppingCart the header cart icon opens, with
 * View-cart / Checkout links) instead of wondering whether the click did
 * anything. No-op when the modal or the bundle is missing — the header
 * badge still updates through the cart-events channel.
 */
export function openCartModal(): void {
  if (typeof document === "undefined") {
    return
  }
  const el = document.getElementById("shoppingCart")
  if (!el) {
    return
  }
  loadBootstrap()
    .then((bs) => {
      try {
        const modal = bs?.Modal?.getInstance?.(el) ?? new bs.Modal(el)
        modal?.show?.()
      } catch {
        // Badge + cart page remain the fallback; never throw from UI chrome.
      }
    })
    .catch(() => {
      // Bundle failed to load — page still renders, badge still updates.
    })
}
