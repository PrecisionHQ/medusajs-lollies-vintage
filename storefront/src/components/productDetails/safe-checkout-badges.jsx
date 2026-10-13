"use client";
import Image from "next/image";
import Ideal from "@modules/common/icons/ideal";
import Bancontact from "@modules/common/icons/bancontact";

/**
 * Guaranteed-safe-checkout trust row. Badges follow the payment providers
 * actually enabled for the region (via /store/payment-providers) instead
 * of a hardcoded image set, so the row can never advertise a method
 * checkout does not offer. When the provider list is missing or empty we
 * fall back to the theme's static six — an empty trust row looks more
 * broken than a generic one.
 */

const CARD_BADGES = [
  { src: "/modave/images/payment/img-1.png", alt: "Visa" },
  { src: "/modave/images/payment/img-2.png", alt: "Mastercard" },
  { src: "/modave/images/payment/img-3.png", alt: "American Express" },
];

const FALLBACK_BADGES = [
  ...CARD_BADGES,
  { src: "/modave/images/payment/img-4.png", alt: "PayPal" },
  { src: "/modave/images/payment/img-5.png", alt: "Diners Club" },
  { src: "/modave/images/payment/img-6.png", alt: "Discover" },
];

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid #e5e5e5",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  background: "#fff",
};

export default function SafeCheckoutBadges({ providerIds }) {
  const ids = providerIds ?? [];
  const has = (prefix) => ids.some((id) => id?.startsWith(prefix));

  // Unknown state (fetch failed) or a region with nothing enabled:
  // keep today's static row rather than rendering nothing.
  if (!ids.length) {
    return (
      <>
        {FALLBACK_BADGES.map((b) => (
          <span key={b.src}>
            <Image alt={b.alt} title={b.alt} src={b.src} width={100} height={64} />
          </span>
        ))}
      </>
    );
  }

  return (
    <>
      {has("pp_stripe") &&
        CARD_BADGES.map((b) => (
          <span key={b.src}>
            <Image alt={b.alt} title={b.alt} src={b.src} width={100} height={64} />
          </span>
        ))}
      {has("pp_paypal") && (
        <span>
          <Image
            alt="PayPal"
            title="PayPal"
            src="/modave/images/payment/img-4.png"
            width={100}
            height={64}
          />
        </span>
      )}
      {(has("ideal") || ids.some((id) => id?.includes("ideal"))) && (
        <span style={chipStyle} title="iDEAL">
          <Ideal /> iDEAL
        </span>
      )}
      {(has("bancontact") || ids.some((id) => id?.includes("bancontact"))) && (
        <span style={chipStyle} title="Bancontact">
          <Bancontact /> Bancontact
        </span>
      )}
      {has("pp_polar") && (
        <span style={chipStyle} title="Polar">
          Polar
        </span>
      )}
      {has("pp_dodo") && (
        <span style={chipStyle} title="Dodo Payments">
          Dodo
        </span>
      )}
      {(has("pp_system_default") || has("pp_manual")) && (
        <span style={chipStyle} title="Manual Payment">
          Manual Payment
        </span>
      )}
    </>
  );
}
