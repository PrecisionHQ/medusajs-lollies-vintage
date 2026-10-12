"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LOCALE_COOKIE,
  TOGGLE_LOCALE,
  isSupportedLocale,
} from "@/i18n/config";
import { countryLocale } from "@/i18n/country-locale";

/**
 * P11-global — Official <-> English toggle. Shows only when the URL
 * country's official language has a shipped dictionary and isn't
 * English. Sets/clears the `lollies-locale` cookie, then refreshes so
 * server components re-render in the chosen language. Country/currency
 * routing is untouched — display language only.
 */
export default function LocaleToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const [, bump] = useState(0);
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const official = countryLocale(countryCode);

  // No toggle for English-default countries or languages without a
  // dictionary yet (they already serve English).
  if (official === TOGGLE_LOCALE || !isSupportedLocale(official)) return null;

  const englishActive =
    typeof document !== "undefined" &&
    document.cookie
      .split("; ")
      .some((c) => c === `${LOCALE_COOKIE}=${TOGGLE_LOCALE}`);

  const switchTo = (value) => {
    if (value) {
      document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; sameSite=lax`;
    } else {
      document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; sameSite=lax`;
    }
    bump((n) => n + 1);
    router.refresh();
  };

  return (
    <li className="nav-locale">
      <a
        href="#"
        className="nav-icon-item"
        style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em" }}
        title={englishActive ? official.toUpperCase() : "EN"}
        onClick={(e) => {
          e.preventDefault();
          switchTo(englishActive ? null : TOGGLE_LOCALE);
        }}
      >
        {englishActive ? official.toUpperCase() : "EN"}
      </a>
    </li>
  );
}
