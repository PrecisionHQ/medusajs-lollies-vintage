"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { loadBootstrap } from "../common/modave-bootstrap";
import {
  hasSubscribedNewsletter,
  markNewsletterSubscribed,
} from "@/lib/util/newsletter";

/**
 * Email-capture popup. Shows on every page load (refresh) after a short
 * delay — unless the visitor already subscribed (suppression flag in
 * localStorage, set by either newsletter form). Live product picks make it
 * attractive, with a "Discounts of up to 40%" hook. Submit posts to our
 * owned subscribe endpoint (double opt-in from our database).
 */
export default function NewsLetterModal({ products = [] }) {
  const modalElement = useRef();
  const shown = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let modal = null;
    const showModal = async () => {
      // Already subscribed (either form sets the flag) — never nag again.
      if (hasSubscribedNewsletter()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (cancelled || shown.current) return;
      const el = document.getElementById("newsletterPopup");
      if (!el) return;
      try {
        const bs = await loadBootstrap();
        modal = new bs.Modal(el, { keyboard: false });
        shown.current = true;
        modal.show();
      } catch {
        // Modal unavailable — page still renders.
      }
    };
    showModal();
    return () => {
      cancelled = true;
      try {
        modal?.hide();
      } catch {}
    };
  }, []);

  const [success, setSuccess] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const handleShowMessage = () => {
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 2000);
  };
  const sendEmail = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    // Owned newsletter list (see Footer1): double opt-in from our database,
    // not the theme's external endpoint.
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/newsletter/subscribe`,
        { email, source: "popup" },
        {
          headers: {
            "x-publishable-api-key":
              process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
          },
        }
      );
      if ([200, 201].includes(response.status)) {
        e.target.reset();
        setSuccess(true);
        // Don't show this popup to this visitor again.
        markNewsletterSubscribed();
        handleShowMessage();
      } else {
        setSuccess(false);
        handleShowMessage();
      }
    } catch (error) {
      console.error("Error:", error.response?.data || "An error occurred");
      setSuccess(false);
      handleShowMessage();
      e.target.reset();
    }
  };

  const picks = (products || []).slice(0, 3);

  return (
    <div
      className="modal modalCentered fade auto-popup modal-newleter"
      id="newsletterPopup"
      ref={modalElement}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-top">
            <Image
              className="lazyload"
              data-src="/modave/images/section/newsletter.jpg"
              alt="Lollies newsletter"
              src="/modave/images/section/newsletter.jpg"
              width={660}
              height={440}
            />
            <span
              className="icon icon-close btn-hide-popup"
              data-bs-dismiss="modal"
            />
          </div>
          <div className="modal-bottom text-center">
            <p className="text-btn-uppercase fw-4 font-2">
              Discounts of up to 40%!
            </p>
            <h5>
              Subscribe and unlock member-only deals, exclusive offers &amp;
              more!
            </h5>
            {picks.length > 0 && (
              <div className="d-flex justify-content-center gap-2 my-3">
                {picks.map((p) => (
                  <Link
                    key={p.id}
                    href={p.href || "#"}
                    className="d-block"
                    style={{
                      width: 72,
                      aspectRatio: "3/4",
                      overflow: "hidden",
                      borderRadius: 8,
                    }}
                  >
                    <Image
                      src={p.imgSrc}
                      alt={p.title}
                      width={144}
                      height={192}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </Link>
                ))}
              </div>
            )}
            <div
              className={`tfSubscribeMsg  footer-sub-element ${
                showMessage ? "active" : ""
              }`}
            >
              {success ? (
                <p style={{ color: "rgb(52, 168, 83)" }}>
                  You have successfully subscribed.
                </p>
              ) : (
                <p style={{ color: "red" }}>Something went wrong</p>
              )}
            </div>
            <form
              id="subscribe-form"
              onSubmit={(e) => {
                e.preventDefault();
                sendEmail(e);
              }}
              className="form-newsletter-subscribe"
            >
              <div id="subscribe-content">
                <input
                  type="email"
                  name="email"
                  id="subscribe-email"
                  placeholder="Enter your e-mail"
                  required
                />
                <button
                  type="submit"
                  id="subscribe-button"
                  className="btn-style-2 radius-12 w-100 justify-content-center"
                >
                  <span className="text text-btn-uppercase">SUBSCRIBE</span>
                </button>
              </div>
              <div id="subscribe-msg" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
