"use client";
import React, { createContext, useContext } from "react";
import { t } from "./translate";

/**
 * P11-global — ships the server-loaded message tree to client components.
 * [countryCode]/layout.tsx (server) imports ONLY the active locale's
 * dictionary and injects it here, so the client bundle never carries
 * all ~70 locales.
 */
export const LocaleContext = createContext<{
  locale: string;
  messages: Record<string, unknown>;
}>({ locale: "en", messages: {} });

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Record<string, unknown>;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, messages }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Client-component helper: const t = useLocaleT(); t("cart.title").
 * Uses the provider messages (full locale); outside a provider it falls
 * back to the baked en/fr/de lookup — never blank, never throws.
 */
export function useLocaleT() {
  const { locale, messages } = useContext(LocaleContext);
  const hasMessages = messages && Object.keys(messages).length > 0;
  return (key: string, vars?: Record<string, string | number>) =>
    t(locale, key, vars, hasMessages ? messages : undefined);
}
