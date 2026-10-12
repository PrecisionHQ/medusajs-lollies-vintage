import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isRtlLocale } from "@/i18n/country-locale";
import { LocaleProvider } from "@/i18n/locale-context";

/**
 * P11-global — per-country locale shell. Resolves the display locale
 * (URL country's official language, overridable to English via the
 * `lollies-locale` cookie set by the header toggle), server-loads ONLY
 * that dictionary, and injects it for all client components below.
 * Also sets text direction for RTL locales (ar/he/fa/ur/...).
 */
export default async function CountryLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ countryCode: string }>;
}) {
  const { countryCode } = await params;
  const jar = await cookies();
  const locale = resolveLocale(
    countryCode,
    jar.get(LOCALE_COOKIE)?.value ?? null
  );
  const messages = getDictionary(locale);
  return (
    <LocaleProvider locale={locale} messages={messages}>
      <div dir={isRtlLocale(locale) ? "rtl" : "ltr"} style={{ display: "contents" }}>
        {children}
      </div>
    </LocaleProvider>
  );
}
