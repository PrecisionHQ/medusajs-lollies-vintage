"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateLineItem,
  deleteLineItem,
  applyPromotions,
  removeDiscount,
} from "@lib/data/cart";
import { convertToLocale } from "@lib/util/money";
import { notifyCartUpdated } from "@lib/util/cart-events";

/**
 * Full cart page in Modave styling, backed by the live Medusa cart:
 * quantities, remove, promo codes, totals, checkout handoff.
 */
export default function ShopCartLive({ cart, countryCode }) {
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState(null);
  const [busy, setBusy] = useState(null);

  if (!cart || !(cart.items || []).length) {
    return (
      <section className="flat-spacing">
        <div className="container text-center">
          <h3 className="heading">Your cart is empty</h3>
          <p className="text-secondary mb-4">
            Start adding your favorite products to cart!
          </p>
          <Link
            href={`/${countryCode}/store`}
            className="tf-btn btn-fill"
          >
            <span className="text">Explore Products</span>
          </Link>
        </div>
      </section>
    );
  }

  const money = (amount) =>
    convertToLocale({
      amount: amount ?? 0,
      currency_code: cart.currency_code || "gbp",
    });

  const refresh = async () => {
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

  const removePromo = async (code) => {
    try {
      await removeDiscount(code);
      await refresh();
    } catch (err) {
      setCouponError(err?.message || "Could not remove code.");
    }
  };

  const step =
    !cart?.shipping_address?.address_1 || !cart.email
      ? "address"
      : (cart?.shipping_methods?.length || 0) === 0
      ? "delivery"
      : "payment";

  return (
    <section className="flat-spacing">
      <div className="container">
        <div className="heading-section text-center">
          <h3 className="heading">Shopping Cart</h3>
        </div>
        <div className="row">
          <div className="col-xl-8">
            <div className="tf-mini-cart-items">
              {cart.items.map((line) => {
                const title =
                  line.variant?.product?.title || line.title || "Item";
                const href = line.variant?.product?.handle
                  ? `/${countryCode}/products/${line.variant.product.handle}`
                  : `/${countryCode}/store`;
                const img =
                  line.variant?.product?.thumbnail || line.thumbnail || "";
                return (
                  <div key={line.id} className="tf-mini-cart-item file-delete">
                    <div className="tf-mini-cart-image">
                      {img ? (
                        <Image
                          className="lazyload"
                          alt={title}
                          src={img}
                          width={600}
                          height={800}
                        />
                      ) : null}
                    </div>
                    <div className="tf-mini-cart-info flex-grow-1">
                      <div className="mb_12 d-flex align-items-center justify-content-between flex-wrap gap-12">
                        <div className="text-title">
                          <Link
                            href={href}
                            className="link text-line-clamp-1"
                          >
                            {title}
                          </Link>
                        </div>
                        <div
                          className="text-button tf-btn-remove remove"
                          onClick={() => removeLine(line.id)}
                        >
                          Remove
                        </div>
                      </div>
                      <div className="text-secondary-2">
                        {line.variant?.title || line.subtitle || ""}
                      </div>
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-12 mt-2">
                        <div className="d-flex align-items-center gap-2">
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
                        <div className="text-button">{money(line.total)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col-xl-4">
            <div className="tf-page-cart-sidebar">
              <form onSubmit={applyCoupon} className="mb-3">
                <div className="text-caption-1 text-secondary mb_8">
                  Discount code
                </div>
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    className="flex-grow-1"
                  />
                  <button type="submit" className="btn-style-2">
                    <span className="text text-btn-uppercase">Apply</span>
                  </button>
                </div>
                {couponError && (
                  <div className="text-danger mt-2">{couponError}</div>
                )}
              </form>
              {(cart.discount_total ?? 0) > 0 && (
                <div className="d-flex justify-content-between mb-2">
                  <span>Discount</span>
                  <span>-{money(cart.discount_total)}</span>
                </div>
              )}
              {(cart.promotions || []).map((promo) => (
                <div
                  key={promo.id || promo.code}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <span className="text-button">{promo.code}</span>
                  <span
                    className="text-button tf-btn-remove remove"
                    onClick={() => promo.code && removePromo(promo.code)}
                  >
                    Remove
                  </span>
                </div>
              ))}
              <div className="tf-cart-totals-discounts">
                <h5>Subtotal</h5>
                <h5 className="tf-totals-total-value">
                  {money(cart.subtotal ?? cart.total ?? 0)}
                </h5>
              </div>
              <p className="text-caption-1 text-secondary">
                Shipping and taxes calculated at checkout.
              </p>
              <Link
                href={`/${countryCode}/checkout?step=${step}`}
                className="tf-btn w-100 btn-fill radius-4 mt-3"
              >
                <span className="text">Go to checkout</span>
              </Link>
              <div className="text-center mt-2">
                <Link
                  className="link text-btn-uppercase"
                  href={`/${countryCode}/store`}
                >
                  Or continue shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
