import en from "./dictionaries/en.json";
import fr from "./dictionaries/fr.json";
import de from "./dictionaries/de.json";
import { DEFAULT_LOCALE, Locale, getLocale } from "./config";

const DICTS: Record<Locale, Record<string, unknown>> = { en, fr, de };

function lookup(dict: Record<string, unknown>, path: string): unknown {
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * Translate a dotted key ("cart.title") with optional {var} interpolation.
 * Falls back to English per key; returns the key itself when missing
 * everywhere (never blank, never throws — safe for partially translated
 * locales).
 */
export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const hit =
    lookup(DICTS[locale] ?? {}, key) ?? lookup(DICTS[DEFAULT_LOCALE], key);
  if (typeof hit !== "string") return key;
  if (!vars) return hit;
  return hit.replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`
  );
}

export function getDictionary(locale: Locale): Record<string, unknown> {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

/**
 * Client-component helper: const t = useT(countryCode); t("cart.title").
 * Pure computation (no React APIs) — safe anywhere a countryCode exists.
 */
export function useT(countryCode?: string | null) {
  const locale = getLocale(countryCode);
  return (key: string, vars?: Record<string, string | number>) =>
    t(locale, key, vars);
}
