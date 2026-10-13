"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { dismissBootstrapOverlays, loadBootstrap } from "./modave-bootstrap";

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
  const firstPath = useRef(true);
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
    // Skip the initial mount — there is no previous page to clean up after.
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    dismissBootstrapOverlays();
  }, [pathname]);
  return null;
}
