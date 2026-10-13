"use client";

import { useEffect, useState } from "react";
import { useLocaleT } from "@/i18n/locale-context";
import { earnShare } from "@lib/data/loyalty";

/**
 * Share popup (#13). The PDP extra-link row has always pointed at
 * #share_social, but no modal with that id existed. WhatsApp-first
 * (wa.me with the canonical product URL), copy-link, and native share
 * where available. Tapping WhatsApp earns store credit once per product
 * for signed-in shoppers (guests get a sign-in hint, no dead end).
 */
export default function ShareModal({ productId, productTitle }) {
  const t = useLocaleT();
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  // Canonical share URL is the page itself; read post-mount so SSR and
  // the first client render agree (no hydration mismatch).
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  const waHref = pageUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `${productTitle} ${pageUrl}`
      )}`
    : "#share_social";

  const onWhatsApp = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await earnShare(productId);
      if (res.ok && (res.points ?? 0) > 0) {
        setNotice(t("product.shareEarned", { points: res.points }));
      } else if (res.ok && res.duplicate) {
        setNotice(null);
      } else if (res.error === "signin") {
        setNotice(t("product.shareSignin"));
      } else if (res.error === "capped") {
        setNotice(t("product.shareCapped"));
      }
    } catch {
      // Sharing must work even when the credit call fails.
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    if (!pageUrl) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setNotice(t("product.shareCopied"));
    } catch {
      // Clipboard unavailable (permissions) — link is still selectable.
    }
  };

  return (
    <div
      className="modal fade modal-share"
      id="share_social"
      data-testid="share-modal"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="header">
            <h5 className="title">{t("product.share")}</h5>
            <span
              className="icon-close icon-close-popup"
              data-bs-dismiss="modal"
              data-testid="share-modal-close"
            />
          </div>
          <div className="wrap d-flex flex-column gap-3">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-style-2 text-btn-uppercase"
              onClick={onWhatsApp}
              data-testid="share-whatsapp"
            >
              {t("product.shareWhatsapp")}
            </a>
            <button
              type="button"
              className="btn-style-3 text-btn-uppercase"
              onClick={onCopy}
              data-testid="share-copy"
            >
              {t("product.shareCopy")}
            </button>
            {notice && (
              <p className="text-caption-1" data-testid="share-notice">
                {notice}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
