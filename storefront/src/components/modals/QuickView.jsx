"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { isEqual } from "lodash";
import { useContextElement } from "@/context/Context";
import QuantitySelect from "../productDetails/QuantitySelect";
import { loadBootstrap } from "../common/modave-bootstrap";
import { fetchLiveProductByHandle } from "@/lib/util/live-product";
import { getProductPrice } from "@/lib/util/get-product-price";
import { stripHtmlToText } from "@/lib/util/sanitize-html";
import { addToCart } from "@lib/data/cart";
import { notifyCartUpdated } from "@lib/util/cart-events";

const optionsAsKeymap = (variantOptions) =>
  variantOptions?.reduce((acc, varopt) => {
    if (varopt.option && varopt.value !== null && varopt.value !== undefined) {
      acc[varopt.option.title] = varopt.value;
    }
    return acc;
  }, {});

/**
 * Quick view popup. Live Medusa products (selected via cards carrying a
 * handle) fetch full detail: image, price, options, quantity and a real
 * add-to-cart. Static demo items keep their legacy rendering.
 */
export default function QuickView() {
  const pathname = usePathname();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const {
    quickViewItem,
    addToWishlist,
    isAddedtoWishlist,
    addToCompareItem,
    isAddedtoCompareItem,
  } = useContextElement();

  const handle = quickViewItem?.handle;

  useEffect(() => {
    setLive(null);
    setOptions({});
    setQuantity(1);
    setError(null);
    if (!handle) return;
    let cancelled = false;
    setLoading(true);
    fetchLiveProductByHandle(handle, countryCode)
      .then((p) => {
        if (cancelled) return;
        setLive(p);
        if (p?.variants?.length === 1) {
          setOptions(optionsAsKeymap(p.variants[0].options) ?? {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle, countryCode]);

  const openSizeGuide = async () => {
    const bs = await loadBootstrap();
    const el = document.getElementById("size-guide");
    if (!el) return;
    const modal = new bs.Modal(el, { keyboard: false });
    modal.show();
  };

  const selectedVariant = useMemo(() => {
    if (!live?.variants?.length) return undefined;
    return live.variants.find((v) =>
      isEqual(optionsAsKeymap(v.options), options)
    );
  }, [live, options]);

  const priceInfo = useMemo(() => {
    if (!live) return null;
    try {
      const { cheapestPrice, variantPrice } = getProductPrice({
        product: live,
        variantId: selectedVariant?.id,
      });
      return variantPrice ?? cheapestPrice;
    } catch {
      return null;
    }
  }, [live, selectedVariant]);

  const optionEntries = useMemo(() => {
    if (!live?.options?.length) return [];
    return live.options.map((opt) => {
      const title = opt.title ?? "";
      const values = [];
      for (const v of live.variants || []) {
        const val = optionsAsKeymap(v.options)?.[title];
        if (val && !values.includes(val)) values.push(val);
      }
      return { title, values };
    });
  }, [live]);

  const handleAdd = async () => {
    if (!selectedVariant?.id) return;
    setAdding(true);
    setError(null);
    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity,
        countryCode,
      });
      notifyCartUpdated();
      router.refresh();
    } catch (e) {
      setError(e?.message ?? "Could not add to cart.");
    } finally {
      setAdding(false);
    }
  };

  // Static demo fallback (legacy numeric items without a handle).
  if (!handle) {
    const item = quickViewItem || {};
    return (
      <div className="modal fullRight fade modal-quick-view" id="quickView">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="wrap mw-100p-hidden">
              <div className="header">
                <h5 className="title">Quick View</h5>
                <span
                  className="icon-close icon-close-popup"
                  data-bs-dismiss="modal"
                />
              </div>
              <div className="tf-product-info-list">
                <div className="tf-product-info-heading">
                  <div className="tf-product-info-name">
                    <h3 className="name">{item.title}</h3>
                  </div>
                  <div className="tf-product-info-desc">
                    <div className="tf-product-info-price">
                      <h5 className="price-on-sale font-2">
                        {typeof item.price === "number"
                          ? `$${item.price.toFixed(2)}`
                          : ""}
                      </h5>
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

  const cardId = handle;
  const img = live?.thumbnail || live?.images?.[0]?.url;
  const desc = stripHtmlToText(live?.description || "").slice(0, 160);

  return (
    <div className="modal fullRight fade modal-quick-view" id="quickView">
      <div className="modal-dialog">
        <div className="modal-content">
          {live?.images?.[0] && (
            <div className="tf-product-media-wrap">
              <Image
                src={live.images[0].url || img}
                alt={live.title}
                width={600}
                height={800}
              />
            </div>
          )}
          <div className="wrap mw-100p-hidden">
            <div className="header">
              <h5 className="title">Quick View</h5>
              <span
                className="icon-close icon-close-popup"
                data-bs-dismiss="modal"
              />
            </div>
            <div className="tf-product-info-list">
              <div className="tf-product-info-heading">
                <div className="tf-product-info-name">
                  <div className="text text-btn-uppercase">Lollies</div>
                  <h3 className="name">{live?.title || quickViewItem?.title}</h3>
                </div>
                <div className="tf-product-info-desc">
                  <div className="tf-product-info-price">
                    <h5 className="price-on-sale font-2">
                      {loading
                        ? "…"
                        : priceInfo?.calculated_price ?? ""}
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
                  {desc ? <p>{desc}</p> : null}
                </div>
              </div>
              <div className="tf-product-info-choose-option">
                {optionEntries.map((opt) => (
                  <div className="variant-picker-item" key={opt.title}>
                    <div className="d-flex justify-content-between mb_12">
                      <div className="variant-picker-label">
                        {opt.title}:{" "}
                        <span className="text-title variant-picker-label-value">
                          {options[opt.title] ?? ""}
                        </span>
                      </div>
                      {/size/i.test(opt.title) && (
                        <a
                          onClick={openSizeGuide}
                          className="size-guide text-title link"
                        >
                          Size Guide
                        </a>
                      )}
                    </div>
                    <div className="variant-picker-values gap12">
                      {opt.values.map((value) => {
                        const id = `qv-${opt.title}-${value}`;
                        const selected = options[opt.title] === value;
                        return (
                          <div
                            key={id}
                            onClick={() =>
                              setOptions((prev) => ({
                                ...prev,
                                [opt.title]: value,
                              }))
                            }
                          >
                            <input
                              type="radio"
                              id={id}
                              checked={selected}
                              readOnly
                            />
                            <label
                              className="style-text size-btn"
                              htmlFor={id}
                              data-value={value}
                            >
                              <span className="text-title">{value}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="tf-product-info-quantity">
                  <div className="title mb_12">Quantity:</div>
                  <QuantitySelect
                    quantity={quantity}
                    setQuantity={setQuantity}
                  />
                </div>
                <div>
                  <div className="tf-product-info-by-btn mb_10">
                    <a
                      className="btn-style-2 flex-grow-1 text-btn-uppercase fw-6 show-shopping-cart"
                      onClick={() => selectedVariant && handleAdd()}
                    >
                      <span>
                        {!selectedVariant
                          ? "Select options"
                          : adding
                          ? "Adding..."
                          : "Add to cart -"}
                      </span>
                      {priceInfo && selectedVariant && (
                        <span className="tf-qty-price total-price">
                          {priceInfo.calculated_price}
                        </span>
                      )}
                    </a>
                    <a
                      href="#compare"
                      onClick={() => addToCompareItem(cardId)}
                      data-bs-toggle="offcanvas"
                      aria-controls="compare"
                      className="box-icon hover-tooltip compare btn-icon-action show-compare"
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
                  {error && <div className="text-danger mb_10">{error}</div>}
                  <Link
                    href={`/${countryCode}/products/${handle}`}
                    className="btn-style-3 text-btn-uppercase"
                  >
                    View full details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
