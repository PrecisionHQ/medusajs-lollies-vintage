import React from "react";
import Link from "next/link";
import Image from "next/image";
import CountdownTimer from "@/components/common/Countdown";
import { requestMessages } from "@/i18n/dictionaries";
import { tWith } from "@/i18n/translate";

/**
 * Limited-time deals banner. Background is a live collage of sale-category
 * product images (passed from the homepage); falls back to the static
 * Modave banner artwork when none are available. A dark overlay keeps the
 * countdown copy readable over any imagery.
 */
export default async function BannerCountdown({ countryCode = "gb", images = [] }) {
  const { locale, messages } = await requestMessages(countryCode);
  const tr = tWith(locale, messages);
  return (
    <section
      className="bg-surface flat-spacing-8 flat-countdown-banner-2"
      style={{
        position: "relative",
        overflow: "hidden",
        ...(images.length === 0
          ? {
              backgroundImage:
                'url("/modave/images/banner/banner-countdown.png")',
            }
          : null),
      }}
    >
      {images.length > 0 && (
        <div aria-hidden style={{ position: "absolute", inset: 0, display: "flex" }}>
          {images.map((src, i) => (
            <div
              key={i}
              style={{ flex: "1 1 0", position: "relative", minWidth: 0 }}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="25vw"
                style={{ objectFit: "cover" }}
              />
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.55)",
            }}
          />
        </div>
      )}
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div className="box-content">
          <div className="box-title">
            <h3>{tr( "countdown.title")}</h3>
            <p className="text-secondary">
              {tr( "countdown.subtitle")}
            </p>
          </div>
          <div className="tf-countdown-lg">
            <div
              className="js-countdown"
              data-timer={1007500}
              data-labels="Days,Hours,Mins,Secs"
            >
              <CountdownTimer style={2} countryCode={countryCode} />
            </div>
          </div>
          <div className="btn-banner">
            <Link
              href={`/${countryCode}/categories/sale`}
              className="tf-btn btn-fill"
            >
              <span className="text">{tr( "common.shopNow")}</span>
              <i className="icon icon-arrowUpRight" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
