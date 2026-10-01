"use client";

import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import { testimonialsWithProduct9 } from "@/data/products";

/**
 * Compact social-proof strip: stars + one-line quote + author, no product
 * photos, avatars, or quick-view. Deliberately slim — a fraction of the
 * original testimonial cards' height.
 */
export default function Testimonials({ parentClass = "flat-spacing" }) {
  const items = (testimonialsWithProduct9 || []).slice(0, 6);
  if (!items.length) return null;
  return (
    <section className={parentClass}>
      <div className="container">
        <div className="heading-section text-center">
          <h3 className="heading wow fadeInUp">Customer Say!</h3>
        </div>
        <div className="swiper tf-sw-testimonial">
          <Swiper
            breakpoints={{
              0: {
                slidesPerView: 1,
                spaceBetween: 15,
                pagination: { clickable: true },
              },
              768: {
                spaceBetween: 20,
                slidesPerView: 2,
                pagination: { clickable: true },
              },
              1024: {
                spaceBetween: 20,
                slidesPerView: 3,
                pagination: { clickable: true },
              },
            }}
            modules={[Pagination]}
            pagination={{
              clickable: true,
              el: ".spd7",
            }}
            dir="ltr"
          >
            {items.map((testimonial, index) => (
              <SwiperSlide key={index}>
                <div className="testi-slim wow fadeInUp">
                  <div className="list-star-default">
                    {[...Array(5)].map((_, i) => (
                      <i key={i} className="icon icon-star" />
                    ))}
                  </div>
                  <p className="text-secondary text-line-clamp-2">
                    {testimonial.quote}
                  </p>
                  <div className="text-title author">
                    {testimonial.author}
                  </div>
                </div>
              </SwiperSlide>
            ))}
            <div className="sw-pagination-testimonial sw-dots type-circle d-flex justify-content-center spd7" />
          </Swiper>
        </div>
      </div>
    </section>
  );
}
