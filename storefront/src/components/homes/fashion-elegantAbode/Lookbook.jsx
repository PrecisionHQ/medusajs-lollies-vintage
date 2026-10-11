import React from "react";
import { getLocale } from "@/i18n/config";
import { t } from "@/i18n/translate";

/**
 * Trendsetters' Lookbook — six autoplaying video tiles (muted loop,
 * playsInline so mobile never hijacks into fullscreen) in a responsive
 * grid: 2-across on mobile, 3-across (two rows of three) on desktop.
 * Replaces the old 2-image Swiper slider + product pins; the section
 * shell (heading/subheading/spacing) is unchanged so the homepage
 * rhythm stays the same.
 */
const LOOKBOOK_VIDEOS = [
  { file: "video-white.mp4", label: "White" },
  { file: "video-black.mp4", label: "Black" },
  { file: "video-green.mp4", label: "Green" },
  { file: "video-purple.mp4", label: "Purple" },
  { file: "video-bridal.mp4", label: "Bridal" },
  { file: "video-gold.mp4", label: "Gold" },
];

export default function Lookbook({ countryCode = "gb" }) {
  const locale = getLocale(countryCode);
  return (
    <section className="flat-spacing">
      <div className="container">
        <div className="heading-section text-center">
          <h3 className="heading">{t(locale, "lookbook.title")}</h3>
          <p className="subheading text-secondary">
            {t(locale, "lookbook.subtitle")}
          </p>
        </div>
        <div className="tf-grid-layout tf-col-2 lg-col-3 lookbook-video-grid">
          {LOOKBOOK_VIDEOS.map(({ file, label }) => (
            <figure key={file} className="lookbook-video wow fadeInUp">
              <video
                src={`/modave/videos/${file}`}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={`${label} lookbook video`}
              />
              <figcaption className="lookbook-video-label">{label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
