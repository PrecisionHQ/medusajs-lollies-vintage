import en from "./dictionaries/en.json";
import fr from "./dictionaries/fr.json";
import de from "./dictionaries/de.json";
import { DEFAULT_LOCALE, Locale, getLocale } from "./config";

/**
 * Baked-in en/fr/de trees. Client-safe (small). Other locales arrive via
 * <LocaleProvider> messages (server-loaded, see dictionaries.ts) — pass
 * them as the 4th arg. Server components should prefer
 * tWith(locale, getDictionary(locale)).
 */
const BAKED: Record<string, Record<string, unknown>> = { en, fr, de };

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
  vars?: Record<string, string | number>,
  messages?: Record<string, unknown>
): string {
  const tree = messages ?? BAKED[locale] ?? {};
  const hit = lookup(tree, key) ?? lookup(BAKED.en, key);
  if (typeof hit !== "string") return key;
  if (!vars) return hit;
  return hit.replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`
  );
}

/** Server-component helper: const tr = tWith(locale, getDictionary(locale)). */
export function tWith(locale: Locale, messages: Record<string, unknown>) {
  return (key: string, vars?: Record<string, string | number>) =>
    t(locale, key, vars, messages);
}

export function getDictionaryBaked(
  locale: Locale
): Record<string, unknown> {
  return BAKED[locale] ?? BAKED[DEFAULT_LOCALE];
}

/**
 * Legacy client-component helper (baked en/fr/de only — no provider
 * messages). Prefer useLocaleT() from locale-context; kept for
 * compatibility. Pure computation (no React APIs) — safe anywhere a
 * countryCode exists.
 */
export function useT(countryCode?: string | null) {
  const locale = getLocale(countryCode);
  return (key: string, vars?: Record<string, string | number>) =>
    t(locale, key, vars);
}
