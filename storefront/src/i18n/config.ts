/**
 * P11-global — locale resolution (hand-rolled, zero new deps).
 * Client-safe: pure data + string logic, no JSON imports (so client
 * components can import this without bloating the bundle).
 *
 * Default locale = the URL country's primary official language
 * (country-locale.ts); the shopper can override to English via the
 * `lollies-locale` cookie (header toggle). Country/currency routing is
 * untouched — this only changes display language.
 *
 * Dictionaries are static JSON served per-locale from the server
 * (dictionaries.ts); t() falls back to English per key (never blank,
 * never crashes), with {var} interpolation. Product/catalog content
 * (names, descriptions, categories, colors, sizes) intentionally stays
 * English: those values drive matching/filtering/URLs. Only UI chrome
 * translates here.
 */

import { countryLocale } from "./country-locale";

export const DEFAULT_LOCALE = "en" as const;
/** BCP-47-ish locale tag; any dictionary key in dictionaries/. */
export type Locale = string;

export const LOCALE_COOKIE = "lollies-locale" as const;
/** The toggle only offers Official <-> English (per decision). */
export const TOGGLE_LOCALE = "en" as const;

/**
 * Locales with a shipped dictionary file. ADDING A LANGUAGE = add the
 * .json + registry line in dictionaries.ts AND the code here (both
 * one-liners; dictionaries.ts asserts they match in dev).
 */
export const SUPPORTED_LOCALES: string[] = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "nl",
  "pt",
  "da",
  "sv",
];

export function isSupportedLocale(locale?: string | null): boolean {
  return !!locale && SUPPORTED_LOCALES.includes(locale);
}

/**
 * Resolve the display locale for a request.
 * @param countryCode URL country (e.g. "fr")
 * @param override cookie value ("en" to force English, anything else ignored)
 */
export function resolveLocale(
  countryCode?: string | null,
  override?: string | null
): Locale {
  if (override === TOGGLE_LOCALE) return DEFAULT_LOCALE;
  const official = countryLocale(countryCode);
  // Serve the official language only when its dictionary exists;
  // otherwise English (t() would fall back per-key anyway).
  if (isSupportedLocale(official)) return official;
  return DEFAULT_LOCALE;
}

/** Back-compat: locale from country alone (no cookie override). */
export function getLocale(countryCode?: string | null): Locale {
  return resolveLocale(countryCode, null);
}

/** Intl locale for number/currency formatting per market (e.g. pt-BR). */
export function getNumberLocale(countryCode?: string | null): string {
  const cc = (countryCode || "").toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return "en-GB";
  const official = countryLocale(cc);
  const lang = isSupportedLocale(official) ? official : "en";
  return `${lang}-${cc.toUpperCase()}`;
}
