import "server-only";
import { cookies } from "next/headers";
import en from "./dictionaries/en.json";
import fr from "./dictionaries/fr.json";
import de from "./dictionaries/de.json";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, resolveLocale } from "./config";

/**
 * P11-global — server-side dictionary registry. Every locale with a file
 * here is a served language; country-locale.ts may map to locales NOT in
 * this map (they resolve to English until their dictionary lands).
 *
 * Server-only on purpose: ~70 locales x 8KB must never enter the client
 * bundle. Client components get their messages via <LocaleProvider>
 * (injected by [countryCode]/layout.tsx), never by importing this file.
 *
 * Adding a language = drop <locale>.json in dictionaries/ + one line in
 * REGISTRY below + the code in SUPPORTED_LOCALES (config.ts).
 */

const REGISTRY: Record<string, Record<string, unknown>> = { en, fr, de };

export const SUPPORTED_LOCALES_SERVER: string[] = Object.keys(REGISTRY);

if (process.env.NODE_ENV !== "production") {
  const a = [...SUPPORTED_LOCALES].sort().join(",");
  const b = [...SUPPORTED_LOCALES_SERVER].sort().join(",");
  if (a !== b) {
    console.warn(
      `[i18n] SUPPORTED_LOCALES (config.ts) [${a}] != dictionary registry [${b}]. Fix both one-liners.`
    );
  }
}

export function isSupportedLocaleServer(locale?: string | null): boolean {
  return (
    !!locale && Object.prototype.hasOwnProperty.call(REGISTRY, locale)
  );
}

/** Full message tree for a locale (English when unsupported — never blank). */
export function getDictionary(locale?: string | null): Record<string, unknown> {
  if (locale && isSupportedLocaleServer(locale)) return REGISTRY[locale];
  return REGISTRY.en;
}

/**
 * Request locale for server components: URL country's official language,
 * overridden to English when the shopper set the toggle cookie.
 */
export async function requestLocale(
  countryCode?: string | null
): Promise<string> {
  const jar = await cookies();
  return resolveLocale(countryCode, jar.get(LOCALE_COOKIE)?.value ?? null);
}

/** requestLocale + getDictionary in one await (common server preamble). */
export async function requestMessages(countryCode?: string | null): Promise<{
  locale: string;
  messages: Record<string, unknown>;
}> {
  const locale = await requestLocale(countryCode);
  return { locale, messages: getDictionary(locale) };
}
