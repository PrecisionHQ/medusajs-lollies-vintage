"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isEqual } from "lodash";
import { Swiper, SwiperSlide } from "swiper/react";
import { Thumbs } from "swiper/modules";
import { useContextElement } from "@/context/Context";
import SizeGuide from "@/components/modals/SizeGuide";
import { addToCart } from "@lib/data/cart";
import { notifyCartUpdated } from "@lib/util/cart-events";
import { getProductPrice } from "@lib/util/get-product-price";
import { stripHtmlToText } from "@lib/util/sanitize-html";
import { getProductReviews } from "@lib/data/reviews";

const optionsAsKeymap = (variantOptions) => {
  return variantOptions?.reduce((acc, varopt) => {
    if (varopt.option && varopt.value !== null && varopt.value !== undefined) {
      acc[varopt.option.title] = varopt.value;
    }
    return acc;
  }, {});
};

const variantInStock = (variant) => {
  if (!variant) return false;
  if (!variant.manage_inventory) return true;
  if (variant.allow_backorder) return true;
  return (variant.inventory_quantity || 0) > 0;
};

const STORE_NAME =
  process.env.NEXT_PUBLIC_STORE_NAME || "Lollies Vintage";

/**
 * Modave-styled product detail section backed by a LIVE Medusa product.
 * Variant selection, pricing, quantity and add-to-cart all run against the
 * real catalogue/cart. Demo-only social proof (fake review counts, sold
 * counters, live viewers) is omitted — rating renders only when the
 * product actually has approved reviews.
 */
export default function ModaveDetailsClient({
  product,
  region,
  countryCode,
}) {
  const router = useRouter();
  const [options, setOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [error, setError] = useState(null);
  const [thumbsSwiper, setThumbsSwiper] = useState(null);
  const [reviewCount, setReviewCount] = useState(null);
  const { addToWishlist, isAddedtoWishlist, isAddedtoCompareItem, addToCompareItem } =
    useContextElement();

  const images = useMemo(() => {
    const imgs = (product.images || [])
      .map((img) => img?.url)
      .filter(Boolean);
    if (imgs.length) return imgs;
    if (product.thumbnail) return [product.thumbnail];
    return [];
  }, [product]);

  // Preselect when there is a single variant, mirroring ProductActions.
  useEffect(() => {
    if (product.variants?.length === 1) {
      setOptions(optionsAsKeymap(product.variants[0].options) ?? {});
    }
  }, [product]);

  useEffect(() => {
    let cancelled = false;
    getProductReviews(product.id)
      .then((res) => {
        if (!cancelled) setReviewCount(res.reviews?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) setReviewCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const selectedVariant = useMemo(() => {
    if (!product.variants?.length) return undefined;
    return product.variants.find((v) =>
      isEqual(optionsAsKeymap(v.options), options)
    );
  }, [product.variants, options]);

  const setOptionValue = (title, value) => {
    setOptions((prev) => ({ ...prev, [title]: value }));
  };

  const inStock = variantInStock(selectedVariant);
  const needsSelection =
    (product.variants?.length ?? 0) > 1 && !selectedVariant;

  const priceInfo = useMemo(() => {
    try {
      const { cheapestPrice, variantPrice } = getProductPrice({
        product,
        variantId: selectedVariant?.id,
      });
      return variantPrice ?? cheapestPrice;
    } catch {
      return null;
    }
  }, [product, selectedVariant]);

  const optionValues = (title) => {
    const vals = [];
    for (const v of product.variants || []) {
      const kv = optionsAsKeymap(v.options);
      if (kv?.[title] && !vals.includes(kv[title])) vals.push(kv[title]);
    }
    return vals;
  };

  const valueDisabled = (title, value) => {
    return !(product.variants || []).some((v) => {
      const kv = optionsAsKeymap(v.options);
      if (kv?.[title] !== value) return false;
      for (const [t, sel] of Object.entries(options)) {
        if (t !== title && sel && kv?.[t] !== sel) return false;
      }
      return variantInStock(v);
    });
  };

  const doAddToCart = async (qty) => {
    if (!selectedVariant?.id) return false;
    setError(null);
    const res = await addToCart({
      variantId: selectedVariant.id,
      quantity: qty,
      countryCode,
    }).catch((e) => ({ error: e?.message }));
    if (res?.error) {
      setError(res.error);
      return false;
    }
    notifyCartUpdated();
    return true;
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await doAddToCart(quantity);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    setBuyingNow(true);
    try {
      const ok = await doAddToCart(quantity);
      if (ok) router.push(`/${countryCode}/cart`);
    } finally {
      setBuyingNow(false);
    }
  };

  const cardId = product.handle || product.id;
  const eyebrow =
    product.categories?.[0]?.name || product.subtitle || "Lollies";
  const shortDescription = stripHtmlToText(product.description || "").slice(
    0,
    220
  );

  return (
    <section className="flat-spacing">
      <div className="tf-main-product section-image-zoom">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              {images.length > 0 ? (
                <>
                  <Swiper
                    className="swiper pdp-gallery-main"
                    spaceBetween={10}
                    thumbs={{ swiper: thumbsSwiper }}
                    modules={[Thumbs]}
                    dir="ltr"
                  >
                    {images.map((src, i) => (
                      <SwiperSlide key={i}>
                        <Image
                          src={src}
                          alt={`${product.title} image ${i + 1}`}
                          width={900}
                          height={1200}
                          priority={i === 0}
                        />
                      </SwiperSlide>
                    ))}
                  </Swiper>
                  {images.length > 1 && (
                    <Swiper
                      className="swiper pdp-gallery-thumbs mt-3"
                      onSwiper={setThumbsSwiper}
                      spaceBetween={10}
                      slidesPerView={4}
                      modules={[Thumbs]}
                      dir="ltr"
                    >
                      {images.map((src, i) => (
                        <SwiperSlide key={i}>
                          <Image
                            src={src}
                            alt=""
                            width={200}
                            height={267}
                          />
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  )}
                </>
              ) : null}
            </div>
            <div className="col-md-6">
              <div className="sticky-top">
                <div className="tf-product-info-wrap position-relative">
                  <div className="tf-zoom-main" />
                  <div className="tf-product-info-list other-image-zoom">
                    <div className="tf-product-info-heading">
                      <div className="tf-product-info-name">
                        <div className="text text-btn-uppercase">{eyebrow}</div>
                        <h3 className="name">{product.title}</h3>
                        {reviewCount !== null && reviewCount > 0 && (
                          <div className="sub">
                            <div className="tf-product-info-rate">
                              <div className="list-star">
                                <i className="icon icon-star" />
                                <i className="icon icon-star" />
                                <i className="icon icon-star" />
                                <i className="icon icon-star" />
                                <i className="icon icon-star" />
                              </div>
                              <div className="text text-caption-1">
                                ({reviewCount} review
                                {reviewCount === 1 ? "" : "s"})
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="tf-product-info-desc">
                        <div className="tf-product-info-price">
                          <h5 className="price-on-sale font-2">
                            {priceInfo?.calculated_price ?? ""}
                          </h5>
                          {priceInfo?.percentage_diff &&
                          parseFloat(priceInfo.percentage_diff) > 0 ? (
                            <>
                              <div className="compare-at-price font-2">
                                {priceInfo.original_price}
                              </div>
                              <div className="badges-on-sale text-btn-uppercase">
                                -{priceInfo.percentage_diff}%
                              </div>
                            </>
                          ) : null}
                        </div>
                        {shortDescription ? <p>{shortDescription}</p> : null}
                      </div>
                    </div>
                    <div className="tf-product-info-choose-option">
                      {(product.options || []).map((option) => {
                        const title = option.title ?? "";
                        const isColor = /colou?r/i.test(title);
                        const isSize = /size/i.test(title);
                        const values = optionValues(title);
                        if (!values.length) return null;
                        return (
                          <div className="variant-picker-item" key={option.id}>
                            <div className="d-flex justify-content-between mb_12">
                              <div className="variant-picker-label">
                                {isColor
                                  ? "Colors: "
                                  : isSize
                                  ? "selected size: "
                                  : `${title}: `}
                                <span className="text-title variant-picker-label-value">
                                  {options[title] ?? ""}
                                </span>
                              </div>
                              {isSize && (
                                <a
                                  href="#size-guide"
                                  data-bs-toggle="modal"
                                  className="size-guide text-title link"
                                >
                                  Size Guide
                                </a>
                              )}
                            </div>
                            <div
                              className={`variant-picker-values ${
                                isColor ? "" : "gap12"
                              }`}
                            >
                              {values.map((value) => {
                                const disabled = valueDisabled(title, value);
                                const id = `pdp-${option.id}-${value}`;
                                const selected = options[title] === value;
                                if (isColor) {
                                  return (
                                    <React.Fragment key={id}>
                                      <input
                                        id={id}
                                        type="radio"
                                        readOnly
                                        checked={selected}
                                        disabled={disabled}
                                      />
                                      <label
                                        className="color-btn"
                                        htmlFor={id}
                                        title={value}
                                        data-value={value}
                                        onClick={() =>
                                          !disabled &&
                                          setOptionValue(title, value)
                                        }
                                      >
                                        <span
                                          className="swatch-value"
                                          style={{
                                            backgroundColor: value,
                                          }}
                                        />
                                      </label>
                                    </React.Fragment>
                                  );
                                }
                                return (
                                  <div
                                    key={id}
                                    onClick={() =>
                                      !disabled && setOptionValue(title, value)
                                    }
                                  >
                                    <input
                                      type="radio"
                                      id={id}
                                      checked={selected}
                                      disabled={disabled}
                                      readOnly
                                    />
                                    <label
                                      className={`style-text size-btn ${
                                        disabled ? "type-disable" : ""
                                      }`}
                                      htmlFor={id}
                                      data-value={value}
                                    >
                                      <span className="text-title">
                                        {value}
                                      </span>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <div className="tf-product-info-quantity">
                        <div className="title mb_12">Quantity:</div>
                        <div className="variant-picker-values gap12 align-items-center d-flex">
                          <button
                            type="button"
                            className="size-btn style-text"
                            onClick={() =>
                              setQuantity((q) => Math.max(1, q - 1))
                            }
                            aria-label="Decrease quantity"
                          >
                            <span className="text-title">-</span>
                          </button>
                          <span className="text-title px-2">{quantity}</span>
                          <button
                            type="button"
                            className="size-btn style-text"
                            onClick={() => setQuantity((q) => q + 1)}
                            aria-label="Increase quantity"
                          >
                            <span className="text-title">+</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="tf-product-info-by-btn mb_10">
                          <a
                            onClick={() => {
                              if (!needsSelection && inStock) handleAddToCart();
                            }}
                            className="btn-style-2 flex-grow-1 text-btn-uppercase fw-6 btn-add-to-cart"
                          >
                            <span>
                              {needsSelection
                                ? "Select options"
                                : !inStock
                                ? "Out of stock"
                                : isAdding
                                ? "Adding..."
                                : "Add to cart -"}
                            </span>
                            {priceInfo && !needsSelection && (
                              <span className="tf-qty-price total-price">
                                {priceInfo.calculated_price}
                              </span>
                            )}
                          </a>
                          <a
                            href="#compare"
                            data-bs-toggle="offcanvas"
                            aria-controls="compare"
                            onClick={() => addToCompareItem(cardId)}
                            className="box-icon hover-tooltip compare btn-icon-action"
                          >
                            <span className="icon icon-gitDiff" />
                            <span className="tooltip text-caption-2">
                              {isAddedtoCompareItem(cardId)
                                ? "Already compared"
                                : "Compare"}
                            </span>
                          </a>
                          <a
                            onClick={() => addToWishlist(cardId)}
                            className="box-icon hover-tooltip text-caption-2 wishlist btn-icon-action"
                          >
                            <span className="icon icon-heart" />
                            <span className="tooltip text-caption-2">
                              {isAddedtoWishlist(cardId)
                                ? "Already Wishlished"
                                : "Wishlist"}
                            </span>
                          </a>
                        </div>
                        <a
                          onClick={() => {
                            if (!needsSelection && inStock) handleBuyNow();
                          }}
                          className="btn-style-3 text-btn-uppercase"
                        >
                          {buyingNow ? "Adding..." : "Buy it now"}
                        </a>
                        {error && (
                          <div className="text-danger mt-2">{error}</div>
                        )}
                      </div>
                      <div className="tf-product-info-help">
                        <div className="tf-product-info-extra-link">
                          <a
                            href="#delivery_return"
                            data-bs-toggle="modal"
                            className="tf-product-extra-icon"
                          >
                            <div className="icon">
                              <i className="icon-shipping" />
                            </div>
                            <p className="text-caption-1">
                              Delivery &amp; Return
                            </p>
                          </a>
                          <a
                            href="#ask_question"
                            data-bs-toggle="modal"
                            className="tf-product-extra-icon"
                          >
                            <div className="icon">
                              <i className="icon-question" />
                            </div>
                            <p className="text-caption-1">Ask A Question</p>
                          </a>
                          <a
                            href="#share_social"
                            data-bs-toggle="modal"
                            className="tf-product-extra-icon"
                          >
                            <div className="icon">
                              <i className="icon-share" />
                            </div>
                            <p className="text-caption-1">Share</p>
                          </a>
                        </div>
                        <div className="tf-product-info-time">
                          <div className="icon">
                            <i className="icon-timer" />
                          </div>
                          <p className="text-caption-1">
                            Estimated Delivery:&nbsp;&nbsp;
                            <span>12-26 days</span>
                            (International), <span>3-6 days</span> (United
                            States)
                          </p>
                        </div>
                        <div className="tf-product-info-return">
                          <div className="icon">
                            <i className="icon-arrowClockwise" />
                          </div>
                          <p className="text-caption-1">
                            Return within <span>45 days</span> of purchase.
                            Duties &amp; taxes are non-refundable.
                          </p>
                        </div>
                      </div>
                      <ul className="tf-product-info-sku">
                        <li>
                          <p className="text-caption-1">SKU:</p>
                          <p className="text-caption-1 text-1">
                            {selectedVariant?.sku || product.handle}
                          </p>
                        </li>
                        <li>
                          <p className="text-caption-1">Vendor:</p>
                          <p className="text-caption-1 text-1">{STORE_NAME}</p>
                        </li>
                        <li>
                          <p className="text-caption-1">Available:</p>
                          <p className="text-caption-1 text-1">
                            {selectedVariant
                              ? inStock
                                ? "Instock"
                                : "Out of stock"
                              : "Select options"}
                          </p>
                        </li>
                        {(product.categories?.length ?? 0) > 0 && (
                          <li>
                            <p className="text-caption-1">Categories:</p>
                            <p className="text-caption-1">
                              {(product.categories || []).map((c, i, arr) => (
                                <span key={c.id}>
                                  <Link
                                    href={`/${countryCode}/categories/${c.handle}`}
                                    className="text-1 link"
                                  >
                                    {c.name}
                                  </Link>
                                  {i < arr.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </p>
                          </li>
                        )}
                      </ul>
                      <div className="tf-product-info-guranteed">
                        <div className="text-title">
                          Guranteed safe checkout:
                        </div>
                        <div className="tf-payment">
                          {["img-1", "img-2", "img-3", "img-4", "img-5", "img-6"].map(
                            (img) => (
                              <span key={img}>
                                <Image
                                  alt=""
                                  src={`/modave/images/payment/${img}.png`}
                                  width={100}
                                  height={64}
                                />
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SizeGuide />
    </section>
  );
}
