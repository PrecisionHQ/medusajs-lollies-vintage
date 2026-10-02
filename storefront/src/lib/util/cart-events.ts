/**
 * Cross-component cart refresh bus. Any successful cart mutation
 * (add/update/remove/promo) calls notifyCartUpdated(); the header badge and
 * the cart drawer subscribe and re-fetch. Decoupled: writers never import
 * readers.
 */
export function notifyCartUpdated() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("lollies:cart-updated"))
}

export function onCartUpdated(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("lollies:cart-updated", handler)
  return () => window.removeEventListener("lollies:cart-updated", handler)
}
