"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactCountryFlag from "react-country-flag";

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

// Symbols for the currencies this store actually charges in. Anything else
// falls back to the bare uppercase code, which is always correct.
const CURRENCY_SYMBOLS = { eur: "€", gbp: "£", usd: "$" };

// The storefront has no i18n system — every page is English. Stated plainly
// rather than offering a language choice that would change nothing.
const STORE_LANGUAGE = "English";

/**
 * Truthful region indicator for the footer. Shows the country, currency and
 * language the visitor is *actually* shopping in — resolved from the URL's
 * country prefix against the backend's live regions (the same source the
 * middleware routes on). Replaces the old Modave CurrencySelect/LanguageSelect,
 * which were hardcoded demo dropdowns (USD/VND, English/Vietnam) that changed
 * nothing and disagreed with the real region.
 *
 * Renders nothing until regions load, and nothing ever on failure: no
 * indicator beats a wrong one, and the footer must not break because a
 * regions fetch failed.
 */
export default function FooterRegionDisplay() {
  const params = useParams();
  const countryCode = params?.countryCode;
  const [region, setRegion] = useState(null);

  useEffect(() => {
    if (!countryCode || !BACKEND_URL || !PUBLISHABLE_KEY) {
      return;
    }
    let cancelled = false;
    fetch(`${BACKEND_URL}/store/regions`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.regions) {
          return;
        }
        const code = String(countryCode).toLowerCase();
        const match = (data.regions ?? []).find((r) =>
          (r.countries ?? []).some(
            (c) => c.iso_2?.toLowerCase() === code
          )
        );
        if (match) {
          setRegion(match);
        }
      })
      .catch(() => {
        // Fail silent (see above).
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  if (!region) {
    return null;
  }
  const code = String(countryCode).toLowerCase();
  const country = (region.countries ?? []).find(
    (c) => c.iso_2?.toLowerCase() === code
  );
  if (!country) {
    return null;
  }
  const currency = String(region.currency_code ?? "").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[currency.toLowerCase()];

  return (
    <div className="tf-cur justify-content-end" data-testid="footer-region">
      <span className="text-caption-1" data-testid="footer-region-country">
        <ReactCountryFlag
          countryCode={country.iso_2.toUpperCase()}
          svg
          style={{ width: "1.2em", height: "1.2em", marginRight: "0.4em" }}
        />
        {country.display_name ?? country.iso_2.toUpperCase()}
      </span>
      <span className="text-caption-1" data-testid="footer-region-currency">
        {symbol ? `${symbol} ${currency}` : currency}
      </span>
      <span className="text-caption-1" data-testid="footer-region-language">
        {STORE_LANGUAGE}
      </span>
    </div>
  );
}
