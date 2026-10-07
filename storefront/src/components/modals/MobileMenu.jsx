"use client";
import React from "react";
import Link from "next/link";
import FooterRegionDisplay from "../common/FooterRegionDisplay";
import { buildLolliesMenu } from "@/lib/util/lollies-menu";
import { usePathname } from "next/navigation";

/**
 * Mobile menu mirroring the Lollies header menu (Home, Shop All, Sales,
 * Bridal, New In). Accepts the same server-built props as Nav; falls back
 * to URL-derived defaults so it never renders dead demo links.
 */
export default function MobileMenu({ menu, shopLinks, catLinks } = {}) {
  const pathname = usePathname();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const defaults = buildLolliesMenu(countryCode);
  const items = menu && menu.length ? menu : defaults.menu;
  const shops =
    shopLinks && shopLinks.length ? shopLinks : defaults.shopLinks;
  const cats = catLinks && catLinks.length ? catLinks : defaults.catLinks;

  const clean = (p) => (p || "").split("?")[0].replace(/\/$/, "") || "/";
  const isActive = (href) => clean(pathname) === clean(href);

  const shopItem = items.find((i) => i.dropdown);
  const topItems = items.filter((i) => !i.dropdown);

  return (
    <div className="offcanvas offcanvas-start canvas-mb" id="mobileMenu">
      <span
        className="icon-close icon-close-popup"
        data-bs-dismiss="offcanvas"
        aria-label="Close"
      />
      <div className="mb-canvas-content">
        <div className="mb-body">
          <div className="mb-content-top">
            <form className="form-search" onSubmit={(e) => e.preventDefault()}>
              <fieldset className="text">
                <input
                  type="text"
                  placeholder="What are you looking for?"
                  className=""
                  name="text"
                  tabIndex={0}
                  defaultValue=""
                  aria-required="true"
                  required
                />
              </fieldset>
              <button className="" type="submit">
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                    stroke="#181818"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20.9984 20.9999L16.6484 16.6499"
                    stroke="#181818"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
            <ul className="nav-ul-mb" id="wrapper-menu-navigation">
              <li
                className={`nav-mb-item ${
                  isActive(`/${countryCode}`) ? "active" : ""
                }`}
              >
                <Link
                  href={topItems[0]?.href || `/${countryCode}`}
                  className="mb-menu-link"
                >
                  <span>{topItems[0]?.label || "Home"}</span>
                </Link>
              </li>
              {shopItem && (
                <li className="nav-mb-item">
                  <a
                    href="#dropdown-menu-shop"
                    className={`collapsed mb-menu-link ${
                      shops.some((l) => isActive(l.href)) ? "active" : ""
                    } `}
                    data-bs-toggle="collapse"
                    aria-expanded="true"
                    aria-controls="dropdown-menu-shop"
                  >
                    <span>{shopItem.label}</span>
                    <span className="btn-open-sub" />
                  </a>
                  <div id="dropdown-menu-shop" className="collapse">
                    <ul className="sub-nav-menu">
                      {shops.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={`sub-nav-link ${
                              isActive(link.href) ? "active" : ""
                            } `}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              )}
              {topItems.slice(1).map((item) => (
                <li
                  key={item.key}
                  className={`nav-mb-item ${
                    isActive(item.href) ? "active" : ""
                  }`}
                >
                  <Link href={item.href} className="mb-menu-link">
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
              <li className="nav-mb-item">
                <a
                  href="#dropdown-menu-cats"
                  className={`collapsed mb-menu-link ${
                    cats.some((l) => isActive(l.href)) ? "active" : ""
                  } `}
                  data-bs-toggle="collapse"
                  aria-expanded="true"
                  aria-controls="dropdown-menu-cats"
                >
                  <span>Categories</span>
                  <span className="btn-open-sub" />
                </a>
                <div id="dropdown-menu-cats" className="collapse">
                  <ul className="sub-nav-menu">
                    {cats.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className={`sub-nav-link ${
                            isActive(link.href) ? "active" : ""
                          } `}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            </ul>
          </div>
          <div className="mb-other-content">
            <div className="group-icon">
              <Link
                href={`/${countryCode}/account`}
                className="site-nav-icon"
              >
                <svg
                  className="icon"
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                    stroke="#181818"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
                    stroke="#181818"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Login
              </Link>
            </div>
            <div className="mb-notice">
              <span className="text-need">Need Help?</span>
            </div>
          </div>
        </div>
        <div className="mb-bottom">
          <div className="bottom-bar-language">
            <FooterRegionDisplay />
          </div>
        </div>
      </div>
    </div>
  );
}
