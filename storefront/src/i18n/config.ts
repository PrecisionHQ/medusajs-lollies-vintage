/**
 * P11 — Locale infrastructure (hand-rolled, zero new deps).
 *
 * Locale derives from the countryCode route param (fr -> French, de ->
 * German, everything else English) — no URL changes. Dictionaries are
 * static JSON; t() falls back to English per key (never blank, never
 * crashes), with {var} interpolation. Product/catalog content (names,
 * descriptions, categories, colors, sizes) intentionally stays English:
 * those values drive matching/filtering/URLs, so translating them would
 * break the shop. Only UI chrome translates here.
 */

export const DEFAULT_LOCALE = "en" as const;
export type Locale = "en" | "fr" | "de";

export function getLocale(countryCode?: string | null): Locale {
  const cc = (countryCode || "").toLowerCase();
  if (cc === "fr") return "fr";
  if (cc === "de") return "de";
  return DEFAULT_LOCALE;
}

/** Intl locale for number/currency formatting per market. */
export function getNumberLocale(countryCode?: string | null): string {
  const cc = (countryCode || "").toLowerCase();
  if (cc === "fr") return "fr-FR";
  if (cc === "de") return "de-DE";
  return "en-GB";
}
