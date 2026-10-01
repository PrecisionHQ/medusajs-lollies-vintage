"use client";
import Link from "next/link";
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import ProductCard1 from "../productCards/ProductCard1";
import { usePathname } from "next/navigation";
import { buildLolliesMenu } from "@/lib/util/lollies-menu";

/**
 * Lollies header menu: Home, Shop All, Sales, Bridal, New In — all wired to
 * live Medusa routes. Replaces the Modave demo tree (Home/Shop/Products/
 * Blog/Pages/Buy Theme pointing at /shop-* and /product-detail/* URLs that
 * do not exist in this storefront).
 *
 * Props (all optional, server-built with the visitor's countryCode):
 * - menu: top-level entries [{key,label,href}]
 * - shopLinks: Shop All dropdown entries [{label,href}]
 * - recentProducts: live Modave-shaped cards for the mega-panel
 * When props are absent the menu is derived from the URL countryCode, so
 * this component never renders a dead demo link wherever it is used.
 */

export default function Nav({ menu, shopLinks, catLinks, recentProducts }) {
  const pathname = usePathname();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const defaults = buildLolliesMenu(countryCode);
  const items = menu && menu.length ? menu : defaults.menu;
  const shops =
    shopLinks && shopLinks.length ? shopLinks : defaults.shopLinks;
  const cats = catLinks && catLinks.length ? catLinks : defaults.catLinks;
  const recent =
    recentProducts && recentProducts.length
      ? recentProducts.slice(0, 4)
      : [];

  const isActive = (href) => {
    const clean = (p) => (p || "").split("?")[0].replace(/\/$/, "") || "/";
    return clean(pathname) === clean(href);
  };

  const shopActive = shops.some((l) => isActive(l.href));

  return (
    <>
      {items.map((item) => {
        if (!item.dropdown) {
          return (
            <li
              key={item.key}
              className={`menu-item ${isActive(item.href) ? "active" : ""}`}
            >
              <Link href={item.href} className="item-link">
                {item.label}
              </Link>
            </li>
          );
        }
        return (
          <li
            key={item.key}
            className={`menu-item ${shopActive ? "active" : ""} `}
          >
            <Link href={item.href} className="item-link">
              {item.label}
              <i className="icon icon-arrow-down" />
            </Link>
            <div className="sub-menu mega-menu">
              <div className="container">
                <div className="row">
                  <div className="col-lg-4">
                    <div className="mega-menu-item">
                      <div className="menu-heading">Shop</div>
                      <ul className="menu-list">
                        {shops.map((link) => (
                          <li
                            key={link.href}
                            className={`menu-item-li ${
                              isActive(link.href) ? "active" : ""
                            } `}
                          >
                            <Link
                              href={link.href}
                              className="menu-link-text"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mega-menu-item">
                      <div className="menu-heading">Categories</div>
                      <ul className="menu-list">
                        {cats.map((link) => (
                          <li
                            key={link.href}
                            className={`menu-item-li ${
                              isActive(link.href) ? "active" : ""
                            } `}
                          >
                            <Link
                              href={link.href}
                              className="menu-link-text"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {recent.length > 0 && (
                    <div className="col-lg-8">
                      <div className="wrapper-sub-shop">
                        <div className="menu-heading">Recent Products</div>
                        <Swiper
                          dir="ltr"
                          className="swiper tf-product-header"
                          slidesPerView={2}
                          spaceBetween={20}
                        >
                          {recent.map((elm) => (
                            <SwiperSlide
                              key={elm.id}
                              className="swiper-slide"
                            >
                              <ProductCard1 product={elm} />
                            </SwiperSlide>
                          ))}
                        </Swiper>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </>
  );
}
