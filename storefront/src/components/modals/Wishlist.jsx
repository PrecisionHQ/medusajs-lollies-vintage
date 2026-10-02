"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useContextElement } from "@/context/Context";
import { allProducts } from "@/data/products";
import { usePathname } from "next/navigation";
import { fetchLiveCardsByHandles } from "@/lib/util/live-product";

/**
 * Wishlist drawer. Resolves ids to cards from static demo data (numeric
 * legacy ids) or live Medusa products (handle strings) — whichever matches.
 * The list itself persists per session via Context localStorage.
 */
const toCard = (elm) => ({
  id: elm.id,
  title: elm.title,
  imgSrc: elm.imgSrc,
  href: elm.href || `/product-detail/${elm.id}`,
  priceDisplay:
    elm.priceDisplay ||
    (typeof elm.price === "number" ? `$${elm.price.toFixed(2)}` : ""),
});

export default function Wishlist() {
  const pathname = usePathname();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const { removeFromWishlist, wishList } = useContextElement();
  const [items, setItems] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const numeric = [];
      const handles = [];
      for (const id of wishList || []) {
        if (typeof id === "number") numeric.push(id);
        else if (id) handles.push(String(id));
      }
      const cards = [
        ...allProducts.filter((elm) => numeric.includes(elm.id)).map(toCard),
      ];
      if (handles.length) {
        const live = await fetchLiveCardsByHandles(handles, countryCode);
        cards.push(...live);
      }
      // Preserve wishlist order.
      const order = new Map(
        (wishList || []).map((id, i) => [String(id), i])
      );
      cards.sort(
        (a, b) => (order.get(String(a.id)) ?? 99) - (order.get(String(b.id)) ?? 99)
      );
      if (!cancelled) setItems(cards);
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [wishList, countryCode]);
  return (
    <div className="modal fullRight fade modal-wishlist" id="wishlist">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="header">
            <h5 className="title">Wish List</h5>
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
                      {items.map((elm, i) => (
                        <div key={i} className="tf-mini-cart-item file-delete">
                          <div className="tf-mini-cart-image">
                            <Image
                              className="lazyload"
                              alt=""
                              src={elm.imgSrc}
                              width={600}
                              height={800}
                            />
                          </div>
                          <div className="tf-mini-cart-info flex-grow-1">
                            <div className="mb_12 d-flex align-items-center justify-content-between flex-wrap gap-12">
                              <div className="text-title">
                                <Link
                                  href={elm.href}
                                  className="link text-line-clamp-1"
                                >
                                  {elm.title}
                                </Link>
                              </div>
                              <div
                                className="text-button tf-btn-remove remove"
                                onClick={() => removeFromWishlist(elm.id)}
                              >
                                Remove
                              </div>
                            </div>
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-12">
                              <div className="text-button">
                                {elm.priceDisplay}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4">
                      Your wishlist is empty. Start adding your favorite
                      products to save them for later!{" "}
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
                <Link
                  href={`/${countryCode}/store`}
                  className="text-btn-uppercase"
                >
                  Or continue shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
