"use client";
import React, { useState, useMemo } from "react";
import Shipping from "./descriptions/Shipping";
import ReturnPolicies from "./descriptions/ReturnPolicies";
import ReviewsTab from "@modules/products/components/product-reviews";
import { sanitizeDescriptionHtml } from "@/lib/util/sanitize-html";

/**
 * Modave tab shell (Description / Customer Reviews / Shipping & Returns /
 * Return Policies) with LIVE content: the real product description and the
 * real review module. Shipping/returns copy stays static (store policy
 * follow-up).
 */
export default function ModaveDescriptionTabs({ product }) {
  const [activeTab, setActiveTab] = useState(1);
  // Merchant HTML, allowlist-sanitized (scripts/styles/attributes stripped,
  // **bold** converted, filler paragraphs dropped).
  const descriptionHtml = useMemo(
    () => sanitizeDescriptionHtml(product.description || ""),
    [product.description]
  );
  return (
    <section className="">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="widget-tabs style-1">
              <ul className="widget-menu-tab">
                <li
                  className={`item-title ${activeTab == 1 ? "active" : ""} `}
                  onClick={() => setActiveTab(1)}
                >
                  <span className="inner">Description</span>
                </li>
                <li
                  className={`item-title ${activeTab == 2 ? "active" : ""} `}
                  onClick={() => setActiveTab(2)}
                >
                  <span className="inner">Customer Reviews</span>
                </li>
                <li
                  className={`item-title ${activeTab == 3 ? "active" : ""} `}
                  onClick={() => setActiveTab(3)}
                >
                  <span className="inner">Shipping &amp; Returns</span>
                </li>
                <li
                  className={`item-title ${activeTab == 4 ? "active" : ""} `}
                  onClick={() => setActiveTab(4)}
                >
                  <span className="inner">Return Policies</span>
                </li>
              </ul>
              <div className="widget-content-tab">
                <div
                  className={`widget-content-inner ${
                    activeTab == 1 ? "active" : ""
                  } `}
                >
                  <div className="tab-description">
                    {descriptionHtml ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                      />
                    ) : (
                      <p>{product.title}</p>
                    )}
                  </div>
                </div>
                <div
                  className={`widget-content-inner ${
                    activeTab == 2 ? "active" : ""
                  } `}
                >
                  <div className="tab-reviews write-cancel-review-wrap">
                    <ReviewsTab productId={product.id} />
                  </div>
                </div>
                <div
                  className={`widget-content-inner ${
                    activeTab == 3 ? "active" : ""
                  } `}
                >
                  <div className="tab-shipping">
                    <Shipping />
                  </div>
                </div>
                <div
                  className={`widget-content-inner ${
                    activeTab == 4 ? "active" : ""
                  } `}
                >
                  <div className="tab-policies">
                    <ReturnPolicies />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
