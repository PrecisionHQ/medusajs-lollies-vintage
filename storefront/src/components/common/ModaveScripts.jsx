"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { dismissBootstrapOverlays, loadBootstrap } from "./modave-bootstrap";

// Module-level last path: ModaveScripts remounts on page changes (it
// renders inside pages, not the shared layout), so a ref would re-arm
// the first-mount skip on every navigation and the dismiss would never
// run. A module singleton survives remounts within the SPA session.
let lastPathname = null;

/**
 * Loads Bootstrap's JS bundle on Modave-themed pages. The theme drives every
 * modal, offcanvas menu, dropdown and collapse purely through
 * `data-bs-toggle` attributes, which are dead without this bundle (no JS is
 * vendored with the theme). Dynamically imported client-side only, rendered
 * inside `.modave-scope` pages (homepage, PDP) so the starter-layout pages
 * are untouched.
 *
 * Also dismisses any open Bootstrap overlay on route change: client-side nav
 * from inside a modal (QuickView "view full details", search suggestions,
 * compare tray, cart modal) never runs Bootstrap's hide path, which used to
 * strand a backdrop + body scroll-lock on the destination page until refresh.
 */
export default function ModaveScripts() {
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    loadBootstrap().then(() => {
      if (!cancelled) {
        document.dispatchEvent(new CustomEvent("modave:scripts-ready"));
      }
    }).catch(() => {
      // Modals degrade to no-ops without the bundle; page still renders.
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    // Skip only the very first mount of the session — there is no
    // previous page to clean up after. Every later change (including
    // across remounts) dismisses stray overlays.
    if (lastPathname !== null && lastPathname !== pathname) {
      dismissBootstrapOverlays();
    }
    lastPathname = pathname;
  }, [pathname]);
  return null;
}
