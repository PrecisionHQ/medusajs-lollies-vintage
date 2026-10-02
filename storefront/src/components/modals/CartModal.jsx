"use client";
import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  retrieveEnrichedCart,
  updateLineItem,
  deleteLineItem,
  applyPromotions,
} from "@lib/data/cart";
import { convertToLocale } from "@lib/util/money";
import { fetchLatestCards } from "@/lib/util/live-product";
import { onCartUpdated, notifyCartUpdated } from "@lib/util/cart-events";

/**
 * Shopping cart drawer on the LIVE Medusa cart: lines with quantity
 * steppers + remove, working coupon codes, live subtotal, live
 * recommendations. Note/shipping panels stay visual (checkout computes
 * the real thing).
 */
export default function CartModal() {
  const pathname = usePathname();
  const router = useRouter();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const [cart, setCart] = useState(null);
  const [recs, setRecs] = useState([]);
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [currentOpenPopup, setCurrentOpenPopup] = useState("");

  const load = useCallback(async () => {
    try {
      const c = await retrieveEnrichedCart();
      setCart(c);
    } catch {
      setCart(null);
    }
  }, []);

  useEffect(() => {
    load();
    fetchLatestCards(4, countryCode)
      .then(setRecs)
      .catch(() => {});
    const el = document.getElementById("shoppingCart");
    const onShow = () => load();
    el?.addEventListener("show.bs.modal", onShow);
    const off = onCartUpdated(load);
    return () => {
      el?.removeEventListener("show.bs.modal", onShow);
      off();
    };
  }, [load, countryCode]);

  const refresh = async () => {
    await load();
    notifyCartUpdated();
    router.refresh();
  };

  const setQty = async (lineId, qty) => {
    if (qty < 1) return;
    setBusy(lineId);
    try {
      await updateLineItem({ lineId, quantity: qty });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const removeLine = async (lineId) => {
    setBusy(lineId);
    try {
      await deleteLineItem(lineId);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const applyCoupon = async (e) => {
    e.preventDefault();
    if (!coupon.trim()) return;
    setCouponError(null);
    try {
      await applyPromotions([coupon.trim()]);
      setCoupon("");
      await refresh();
    } catch (err) {
      setCouponError(err?.message || "That code didn't work.");
    }
  };

  const money = (amount) =>
    convertToLocale({
      amount: amount ?? 0,
      currency_code: cart?.currency_code || "gbp",
    });

  const items = cart?.items || [];
  const lineTitle = (line) =>
    line.variant?.product?.title || line.title || "Item";
  const lineHref = (line) =>
    line.variant?.product?.handle
      ? `/${countryCode}/products/${line.variant.product.handle}`
      : `/${countryCode}/store`;
  const lineImage = (line) =>
    line.variant?.product?.thumbnail || line.thumbnail || "";
  const lineOption = (line) => line.variant?.title || line.subtitle || "";

  return (
    <div className="modal fullRight fade modal-shopping-cart" id="shoppingCart">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="tf-minicart-recommendations">
            <h6 className="title">You May Also Like</h6>
            <div className="wrap-recommendations">
              <div className="list-cart">
                {recs.map((product, index) => (
                  <div className="list-cart-item" key={product.id || index}>
                    <div className="image">
                      <Image
                        className="lazyload"
                        alt={product.title}
                        src={product.imgSrc}
                        width={600}
                        height={800}
                      />
                    </div>
                    <div className="content">
                      <div className="name">
                        <Link
                          className="link text-line-clamp-1"
                          href={product.href || "#"}
                        >
                          {product.title}
                        </Link>
                      </div>
                      <div className="cart-item-bot">
                        <div className="text-button price">
                          {product.priceDisplay}
                        </div>
                        <Link
                          className="link text-button"
                          href={product.href || "#"}
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="d-flex flex-column flex-grow-1 h-100">
            <div className="header">
              <h5 className="title">Shopping Cart</h5>
              <span
                className="icon-close icon-close-popup"
                data-bs-dismiss="modal"
              />
            </div>
            <div className="wrap">
              <div className="tf-mini-cart-wrap">
                <div className="tf-mini-cart-main">
                  <div className="tf-mini-cart-sroll">
                    {items.length ? (
                      <div className="tf-mini-cart-items">
                        {items.map((line) => (
                          <div
                            key={line.id}
                            className="tf-mini-cart-item file-delete"
                          >
                            <div className="tf-mini-cart-image">
                              {lineImage(line) ? (
                                <Image
                                  className="lazyload"
                                  alt=""
                                  src={lineImage(line)}
                                  width={600}
                                  height={800}
                                />
                              ) : null}
                            </div>
                            <div className="tf-mini-cart-info flex-grow-1">
                              <div className="mb_12 d-flex align-items-center justify-content-between flex-wrap gap-12">
                                <div className="text-title">
                                  <Link
                                    href={lineHref(line)}
                                    className="link text-line-clamp-1"
                                  >
                                    {lineTitle(line)}
                                  </Link>
                                </div>
                                <div
                                  className="text-button tf-btn-remove remove"
                                  onClick={() => removeLine(line.id)}
                                >
                                  Remove
                                </div>
                              </div>
                              <div className="d-flex align-items-center justify-content-between flex-wrap gap-12">
                                <div className="text-secondary-2">
                                  {lineOption(line)}
                                </div>
                                <div className="text-button">
                                  {money(line.total)}
                                </div>
                              </div>
                              <div className="d-flex align-items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  className="size-btn style-text"
                                  disabled={busy === line.id}
                                  onClick={() =>
                                    setQty(line.id, (line.quantity || 1) - 1)
                                  }
                                  aria-label="Decrease quantity"
                                >
                                  <span className="text-title">-</span>
                                </button>
                                <span className="text-title px-2">
                                  {line.quantity}
                                </span>
                                <button
                                  type="button"
                                  className="size-btn style-text"
                                  disabled={busy === line.id}
                                  onClick={() =>
                                    setQty(line.id, (line.quantity || 1) + 1)
                                  }
                                  aria-label="Increase quantity"
                                >
                                  <span className="text-title">+</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4">
                        Your Cart is empty. Start adding favorite products to
                        cart!{" "}
                        <Link
                          className="btn-line"
                          href={`/${countryCode}/store`}
                        >
                          Explore Products
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
                <div className="tf-mini-cart-bottom">
                  <div className="tf-mini-cart-tool">
                    <div
                      className="tf-mini-cart-tool-btn btn-add-coupon"
                      onClick={() => setCurrentOpenPopup("add-coupon")}
                    >
                      <div className="text-caption-1">Coupon</div>
                    </div>
                  </div>
                  <div className="tf-mini-cart-bottom-wrap">
                    <div className="tf-cart-totals-discounts">
                      <h5>Subtotal</h5>
                      <h5 className="tf-totals-total-value">
                        {money(cart?.subtotal ?? cart?.total ?? 0)}
                      </h5>
                    </div>
                    <div className="tf-mini-cart-view-checkout">
                      <Link
                        href={`/${countryCode}/cart`}
                        className="tf-btn w-100 btn-white radius-4 has-border"
                      >
                        <span className="text">View cart</span>
                      </Link>
                      <Link
                        href={`/${countryCode}/cart`}
                        className="tf-btn w-100 btn-fill radius-4"
                      >
                        <span className="text">Check Out</span>
                      </Link>
                    </div>
                    <div className="text-center">
                      <Link
                        className="link text-btn-uppercase"
                        href={`/${countryCode}/store`}
                      >
                        Or continue shopping
                      </Link>
                    </div>
                  </div>
                </div>
                <div
                  className={`tf-mini-cart-tool-openable ${
                    currentOpenPopup == "add-coupon" ? "open" : ""
                  } `}
                >
                  <div className="tf-mini-cart-tool-content">
                    <label className="tf-mini-cart-tool-text">
                      <span className="text-title">Add A Coupon Code</span>
                    </label>
                    <form
                      className="form-add-coupon tf-mini-cart-tool-wrap"
                      onSubmit={applyCoupon}
                    >
                      <fieldset className="">
                        <div className="text-caption-1 text-secondary mb_8">
                          Enter Code
                        </div>
                        <input
                          type="text"
                          placeholder="Discount code"
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value)}
                        />
                      </fieldset>
                      {couponError && (
                        <div className="text-danger mb_8">{couponError}</div>
                      )}
                      <div className="tf-cart-tool-btns">
                        <button type="submit" className="btn-style-2 w-100">
                          <span className="text text-btn-uppercase">Save</span>
                        </button>
                        <div
                          className="text-center w-100 text-btn-uppercase tf-mini-cart-tool-close"
                          onClick={() => setCurrentOpenPopup("")}
                        >
                          Cancel
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
