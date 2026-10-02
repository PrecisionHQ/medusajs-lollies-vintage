"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContextElement } from "@/context/Context";
import { allProducts } from "@/data/products";
import {
  fetchLiveCardsByHandles,
  fetchLiveProductByHandle,
} from "@/lib/util/live-product";

const toCard = (elm) => ({
  id: elm.id,
  handle: elm.handle || null,
  title: elm.title,
  imgSrc: elm.imgSrc,
  href: elm.href || `/product-detail/${elm.id}`,
  priceDisplay:
    elm.priceDisplay ||
    (typeof elm.price === "number" ? `$${elm.price.toFixed(2)}` : ""),
});

/**
 * Compare tray (max two products via Context FIFO cap). Static demo ids
 * resolve locally; live handles fetch full products so the side-by-side
 * table shows real options alongside image, title and price.
 */
export default function Compare() {
  const pathname = usePathname();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const { removeFromCompareItem, compareItem, setCompareItem } =
    useContextElement();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const ids = (compareItem || []).slice(0, 2);
      const numeric = [];
      const handles = [];
      for (const id of ids) {
        if (typeof id === "number") numeric.push(id);
        else if (id) handles.push(String(id));
      }
      const cards = allProducts
        .filter((elm) => numeric.includes(elm.id))
        .map((elm) => ({ ...toCard(elm), specs: [] }));
      if (handles.length) {
        const full = await Promise.all(
          handles.map((h) => fetchLiveProductByHandle(h, countryCode))
        );
        const liveCards = await fetchLiveCardsByHandles(handles, countryCode);
        const byHandle = new Map(liveCards.map((c) => [String(c.id), c]));
        for (const p of full) {
          if (!p) continue;
          const card = byHandle.get(p.handle) || toCard({ ...p, id: p.handle });
          const colors = [];
          const sizes = [];
          for (const v of p.variants || []) {
            for (const o of v.options || []) {
              const title = (o.option?.title || "").toLowerCase();
              if (title.includes("color") || title.includes("colour")) {
                if (o.value && !colors.includes(o.value)) colors.push(o.value);
              } else if (o.value && !sizes.includes(o.value)) {
                sizes.push(o.value);
              }
            }
          }
          cards.push({ ...card, specs: { colors, sizes } });
        }
      }
      const order = new Map(ids.map((id, i) => [String(id), i]));
      cards.sort(
        (a, b) => (order.get(String(a.id)) ?? 99) - (order.get(String(b.id)) ?? 99)
      );
      if (!cancelled) setItems(cards.slice(0, 2));
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [compareItem, countryCode]);

  return (
    <div className="offcanvas offcanvas-bottom offcanvas-compare" id="compare">
      <div className="offcanvas-content">
        <div className="header">
          <span
            className="icon-close icon-close-popup"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          />
        </div>
        <div className="wrap">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="tf-compare-list list-file-delete">
                  <div className="tf-compare-head">
                    <h5 className="title">
                      Compare <br />
                      Products
                    </h5>
                  </div>
                  {items.length ? (
                    <div className="tf-compare-wrap">
                      {items.map((elm, i) => (
                        <div key={i} className="tf-compare-item file-delete">
                          <span
                            className="icon-close remove"
                            style={{ cursor: "pointer" }}
                            onClick={() => removeFromCompareItem(elm.id)}
                          />
                          <Link href={elm.href} className="image">
                            <Image
                              className="lazyload"
                              alt={elm.title}
                              src={elm.imgSrc}
                              width={600}
                              height={800}
                            />
                          </Link>
                          <div className="content">
                            <div className="text-title">
                              <Link
                                className="link text-line-clamp-2"
                                href={elm.href}
                              >
                                {elm.title}
                              </Link>
                            </div>
                            <div className="text-button">
                              {elm.priceDisplay}
                            </div>
                            {elm.specs && (
                              <div className="text-caption-1 text-secondary">
                                {elm.specs.colors?.length > 0 && (
                                  <div>Colors: {elm.specs.colors.join(", ")}</div>
                                )}
                                {elm.specs.sizes?.length > 0 && (
                                  <div>Sizes: {elm.specs.sizes.join(", ")}</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      No items added to compare yet. Browse Products to find
                      items you’d like to compare.
                    </div>
                  )}
                  <div className="tf-compare-buttons">
                    <div className="tf-compare-buttons-wrap">
                      <div
                        onClick={() => setCompareItem([])}
                        className="tf-compapre-button-clear-all clear-file-delete tf-btn w-100 btn-fill radius-4"
                      >
                        <span className="text text-btn-uppercase">
                          Clear All Products
                        </span>
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
  );
}
