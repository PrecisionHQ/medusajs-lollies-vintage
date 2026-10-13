"use client";

import { useLocaleT } from "@/i18n/locale-context";

/**
 * Delivery & Return popup for the live PDP. The PDP extra-link row has
 * always pointed at #delivery_return, but no modal with that id existed,
 * so the click was a silent no-op. Mounted inside ModaveDetailsClient
 * next to SizeGuide; opened purely through data-bs-toggle like the rest
 * of the theme (no JS wiring needed).
 */
export default function ShippingReturnsModal() {
  const t = useLocaleT();
  return (
    <div
      className="modal fade modal-delivery-return"
      id="delivery_return"
      data-testid="shipping-modal"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="header">
            <h5 className="title">{t("product.deliveryReturn")}</h5>
            <span
              className="icon-close icon-close-popup"
              data-bs-dismiss="modal"
              data-testid="shipping-modal-close"
            />
          </div>
          <div className="wrap">
            <div className="text-small-regular">
              <p className="mb_12">
                <span className="text-title">
                  {t("product.estimatedDelivery")}
                </span>{" "}
                12-26 days ({t("product.international")}), 3-6 days (
                {t("product.unitedStates")})
              </p>
              <p className="mb_12">{t("product.returnPolicy")}</p>
              <p className="text-secondary">
                Is the fit not quite right? No worries — we&apos;ll exchange
                your product for a new one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
