"use client";
import { heroVideoSlides } from "@/data/heroSlides";
import React, { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import { Autoplay, Pagination } from "swiper/modules";
import { usePathname } from "next/navigation";

/**
 * Elegant Abode hero — split panel: text card left, portrait video right. Each slide's stage carries the clip's own backdrop color
 * (`slide.bgColor`, sampled from the file) so the video blends into the
 * background seamlessly. The video is displayed at a fixed 480px width
 * and all six render the same ~600px height (4:5 aspect) — no stage
 * jumps between slides, nothing cropped, no pixelated zoom. The text
 * card runs up to 620px (flex, original display typography).
 *
 * Swiper autoplay advances per-slide on the clip's real duration
 * (`data-swiper-autoplay`); the video `ended` event is the primary
 * trigger and the timer the fallback. Only the active slide's video
 * plays — the rest pause so six clips don't decode at once.
 */
export default function Hero() {
  const pathname = usePathname();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const swiperRef = useRef(null);
  const videoRefs = useRef([]);

  const setActiveVideo = (idx) => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === idx) {
        try {
          video.currentTime = 0;
        } catch {
          // Not seekable yet (still loading) — play() will start at 0 anyway.
        }
        video.play().catch(() => {
          // Autoplay can be blocked in rare cases; the swiper timer still
          // advances the slide, so this failure is non-fatal.
        });
      } else {
        video.pause();
      }
    });
  };

  return (
    <section className="tf-slideshow slider-style2 slider-effect-fade">
      <Swiper
        className="swiper tf-sw-slideshow"
        centeredSlides={false}
        spaceBetween={0}
        loop={true}
        modules={[Pagination, Autoplay]}
        autoplay={{
          delay: heroVideoSlides[0].delayMs,
          disableOnInteraction: false,
          stopOnLastSlide: false,
        }}
        pagination={{
          clickable: true,
          el: ".spd33",
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          setActiveVideo(swiper.realIndex ?? 0);
        }}
        onSlideChange={(swiper) => setActiveVideo(swiper.realIndex)}
        dir="ltr"
      >
        {heroVideoSlides.map((slide, i) => (
          <SwiperSlide key={slide.id} data-swiper-autoplay={slide.delayMs}>
            <div
              className="wrap-slider hero-split"
              style={{ backgroundColor: slide.bgColor }}
            >
              <div className="container hero-split-inner">
                <div className="hero-split-content">
                  <div className="content-slider card-box bg-main">
                    <div className="box-title-slider">
                      <div
                        className="fade-item fade-item-1 heading title-display text-white"
                        style={slide.headingStyle}
                        dangerouslySetInnerHTML={{
                          __html: slide.heading,
                        }}
                      />
                      <p className="fade-item fade-item-2 body-text-1 text-white">
                        {slide.description}
                      </p>
                    </div>
                    <div className="fade-item fade-item-3 box-btn-slider">
                      <Link
                        href={`/${countryCode}/store`}
                        className="tf-btn btn-fill btn-white"
                      >
                        <span className="text">{slide.buttonText}</span>
                        <i className="icon icon-arrowUpRight" />
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="hero-split-video">
                  <video
                    className="hero-video"
                    ref={(el) => {
                      videoRefs.current[i] = el;
                    }}
                    src={slide.videoSrc}
                    muted
                    playsInline
                    preload={i === 0 ? "auto" : "metadata"}
                    onEnded={() => swiperRef.current?.slideNext()}
                    aria-label={`${slide.label} collection video`}
                  />
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="wrap-pagination">
        <div className="container">
          <div className="sw-dots sw-pagination-slider type-circle justify-content-center spd33" />
        </div>
      </div>
    </section>
  );
}
