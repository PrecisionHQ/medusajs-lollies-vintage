"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import FooterRegionDisplay from "../common/FooterRegionDisplay";
import ToolbarBottom from "../headers/ToolbarBottom";
import ScrollTop from "../common/ScrollTop";
import { footerLinks, socialLinks } from "@/data/footerLinks";
import axios from "axios";

/**
 * Payment badges in lolliesvintage.com's order. Badge images come from the
 * vendored theme set where they identifiably match (Visa, Mastercard,
 * Amex, PayPal, Maestro, Google Pay, Apple Pay glyph); the rest render as
 * text chips in the same bordered container so the row stays uniform.
 */
const PAYMENTS = [
  { name: "American Express", img: "/modave/images/payment/img-3.png" },
  { name: "Apple Pay", img: "/modave/images/payment/applePay.png", text: "Pay" },
  { name: "BLIK" },
  { name: "Google Pay", img: "/modave/images/payment/img-9.png" },
  { name: "Klarna", img: "/modave/images/payment/klarna.svg" },
  { name: "Maestro", img: "/modave/images/payment/img-8.png" },
  { name: "Mastercard", img: "/modave/images/payment/img-2.png" },
  { name: "MobilePay", img: "/modave/images/payment/mobilepay.svg" },
  { name: "PayPal", img: "/modave/images/payment/img-4.png" },
  { name: "Shop Pay", img: "/modave/images/payment/shoppay.svg" },
  { name: "Union Pay", img: "/modave/images/payment/unionpay.svg" },
  { name: "USDC", img: "/modave/images/payment/usdc.svg" },
  { name: "Visa", img: "/modave/images/payment/img-1.png" },
];
export default function Footer1({
  border = true,
  dark = false,
  hasPaddingBottom = false,
}) {
  const [success, setSuccess] = useState(true);
  const [showMessage, setShowMessage] = useState(false);

  const handleShowMessage = () => {
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 2000);
  };

  const sendEmail = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    const email = e.target.email.value;

    try {
      const response = await axios.post(
        "https://express-brevomail.vercel.app/api/contacts",
        {
          email,
        }
      );

      if ([200, 201].includes(response.status)) {
        e.target.reset(); // Reset the form
        setSuccess(true); // Set success state
        handleShowMessage();
      } else {
        setSuccess(false); // Handle unexpected responses
        handleShowMessage();
      }
    } catch (error) {
      console.error("Error:", error.response?.data || "An error occurred");
      setSuccess(false); // Set error state
      handleShowMessage();
      e.target.reset(); // Reset the form
    }
  };
  useEffect(() => {
    const headings = document.querySelectorAll(".footer-heading-mobile");

    const toggleOpen = (event) => {
      const parent = event.target.closest(".footer-col-block");
      const content = parent.querySelector(".tf-collapse-content");

      if (parent.classList.contains("open")) {
        parent.classList.remove("open");
        content.style.height = "0px";
      } else {
        parent.classList.add("open");
        content.style.height = content.scrollHeight + 10 + "px";
      }
    };

    headings.forEach((heading) => {
      heading.addEventListener("click", toggleOpen);
    });

    // Clean up event listeners when the component unmounts
    return () => {
      headings.forEach((heading) => {
        heading.removeEventListener("click", toggleOpen);
      });
    };
  }, []); // Empty dependency array means this will run only once on mount
  return (
    <>
      {/* Payment band directly above the footer: same 13-method set as
          lolliesvintage.com, uniform white badge chips. */}
      <section className="pay-band">
        <div className="container">
          <div className="pay-band-inner">
            <p className="text-caption-1">We Accept:</p>
            <ul>
              {PAYMENTS.map((p) => (
                <li key={p.name} className="pay-chip" title={p.name}>
                  {p.img ? (
                    <Image
                      alt={p.name}
                      src={p.img}
                      width={44}
                      height={28}
                    />
                  ) : null}
                  {p.text ? (
                    <span>{p.text}</span>
                  ) : !p.img ? (
                    <span>{p.name}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <footer
        id="footer"
        className={`footer ${dark ? "bg-main" : ""} ${
          hasPaddingBottom ? "has-pb" : ""
        } `}
      >
        <div className={`footer-wrap ${!border ? "border-0" : ""}`}>
          <div className="footer-body">
            <div className="container">
              <div className="row">
                <div className="col-lg-4">
                  <div className="footer-infor">
                    <div className="footer-logo">
                      <Link href={`/`}>
                        {/* Lollies mark on a white chip so it reads on the
                            dark footer (the artwork has dark text). */}
                        <span className="footer-logo-chip">
                          <Image
                            alt="Lollies Vintage"
                            src="/modave/images/logo/lollies.webp"
                            width={108}
                            height={108}
                          />
                        </span>
                      </Link>
                    </div>
                    <ul className="footer-info">
                      <li>
                        <i className="icon-mail" />
                        <p>lolliesvintage1@yahoo.com</p>
                      </li>
                    </ul>
                    <ul
                      className={`tf-social-icon  ${
                        dark ? "style-white" : ""
                      } `}
                    >
                      {socialLinks.map((link, index) => (
                        <li key={index}>
                          <a
                            href={link.href}
                            className={link.className}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={link.label}
                            title={link.label}
                          >
                            {link.svgPath ? (
                              <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d={link.svgPath} />
                              </svg>
                            ) : (
                              <i className={`icon ${link.iconClass}`} />
                            )}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="footer-menu">
                    {footerLinks.map((section, sectionIndex) => (
                      <div className="footer-col-block" key={sectionIndex}>
                        <div className="footer-heading text-button footer-heading-mobile">
                          {section.heading}
                        </div>
                        <div className="tf-collapse-content">
                          <ul className="footer-menu-list">
                            {section.items.map((item, itemIndex) => (
                              <li className="text-caption-1" key={itemIndex}>
                                {item.isLink ? (
                                  <Link
                                    href={item.href}
                                    className="footer-menu_item"
                                  >
                                    {item.label}
                                  </Link>
                                ) : (
                                  <a
                                    href={item.href}
                                    className="footer-menu_item"
                                  >
                                    {item.label}
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="footer-col-block">
                    <div className="footer-heading text-button footer-heading-mobile">
                      Newletter
                    </div>
                    <div className="tf-collapse-content">
                      <div className="footer-newsletter">
                        <p className="text-caption-1">
                          Sign up for our newsletter and get 10% off your first
                          purchase
                        </p>
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
                          onSubmit={sendEmail}
                          className={`form-newsletter subscribe-form ${
                            dark ? "style-black" : ""
                          }`}
                        >
                          <div className="subscribe-content">
                            <fieldset className="email">
                              <input
                                type="email"
                                name="email"
                                className="subscribe-email"
                                placeholder="Enter your e-mail"
                                tabIndex={0}
                                aria-required="true"
                              />
                            </fieldset>
                            <div className="button-submit">
                              <button
                                className="subscribe-button"
                                type="submit"
                              >
                                <i className="icon icon-arrowUpRight" />
                              </button>
                            </div>
                          </div>
                          <div className="subscribe-msg" />
                        </form>
                        <div className="tf-cart-checkbox">
                          <div className="tf-checkbox-wrapp">
                            <input
                              className=""
                              type="checkbox"
                              id="footer-Form_agree"
                              name="agree_checkbox"
                            />
                            <div>
                              <i className="icon-check" />
                            </div>
                          </div>
                          <label
                            className="text-caption-1"
                            htmlFor="footer-Form_agree"
                          >
                            By clicking subcribe, you agree to the{" "}
                            <Link className="fw-6 link" href={`/term-of-use`}>
                              Terms of Service
                            </Link>{" "}
                            and{" "}
                            <a className="fw-6 link" href="#">
                              Privacy Policy
                            </a>
                            .
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="container">
              <div className="row">
                <div className="col-12">
                  <div className="footer-bottom-wrap">
                    <div className="left">
                      <p className="text-caption-1">
                        ©{new Date().getFullYear()} Lollies Vintage. All Rights
                        Reserved.
                      </p>
                      <FooterRegionDisplay />
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </footer>
      <ScrollTop hasPaddingBottom={hasPaddingBottom} />
      <ToolbarBottom />
    </>
  );
}
