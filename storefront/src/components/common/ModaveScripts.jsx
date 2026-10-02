"use client";
import { useEffect } from "react";
import { loadBootstrap } from "./modave-bootstrap";

/**
 * Loads Bootstrap's JS bundle on Modave-themed pages. The theme drives every
 * modal, offcanvas menu, dropdown and collapse purely through
 * `data-bs-toggle` attributes, which are dead without this bundle (no JS is
 * vendored with the theme). Dynamically imported client-side only, rendered
 * inside `.modave-scope` pages (homepage, PDP) so the starter-layout pages
 * are untouched.
 */
export default function ModaveScripts() {
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
  return null;
}
