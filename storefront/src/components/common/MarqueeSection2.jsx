import React from "react";
import { requestMessages } from "@/i18n/dictionaries";
import { tWith } from "@/i18n/translate";

export default async function MarqueeSection2({ parentClass = "tf-marquee", countryCode = "gb" }) {
  const { locale, messages } = await requestMessages(countryCode);
  const tr = tWith(locale, messages);
  return (
    <section className={parentClass}>
      <div className="marquee-wrapper">
        <div className="initial-child-container">
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeShipping")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeReturns")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          {/* 2 */}
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeShipping")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeReturns")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          {/* 3 */}
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeShipping")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeReturns")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          {/* 4 */}
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeShipping")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeReturns")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          {/* 5 */}
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeShipping")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeReturns")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          {/* 6 */}
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeShipping")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
          <div className="marquee-child-item">
            <p className="text-btn-uppercase">
              {tr( "home.marqueeReturns")}
            </p>
          </div>
          <div className="marquee-child-item">
            <span className="icon icon-lightning-line" />
          </div>
        </div>
      </div>
    </section>
  );
}
