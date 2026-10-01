"use client";
import ProductCard1 from "@/components/productCards/ProductCard1";
import { products } from "@/data/products";
import React from "react";
import Link from "next/link";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
export default function Products({ liveItems }) {
  // Live Medusa products (already adapted to the Modave card shape) take
  // precedence when the preview page supplies them. Falls back to the static
  // demo slice so the section still renders with the backend down.
  const list =
    liveItems && liveItems.length ? liveItems.slice(0, 4) : products.slice(0, 4);
  return (
    <section className="flat-spacing-3 pt-0">
      <div className="container">
        <div className="heading-section text-center wow fadeInUp">
          <h3>Today's Top Picks</h3>
          <p className="subheading text-secondary">
            Fresh styles just in! Elevate your look.
          </p>
        </div>
        <Swiper
          className="swiper tf-sw-latest"
          dir="ltr"
          spaceBetween={15}
          breakpoints={{
            0: { slidesPerView: 2, spaceBetween: 15 },

            768: { slidesPerView: 3, spaceBetween: 30 },
            1200: { slidesPerView: 4, spaceBetween: 30 },
          }}
          modules={[Pagination]}
          pagination={{
            clickable: true,
            el: ".spd444",
          }}
        >
          {list.map((product, i) => (
            <SwiperSlide key={product.id ?? i} className="swiper-slide">
              <ProductCard1 product={product} />
            </SwiperSlide>
          ))}

          <div className="sw-pagination-latest spd444  sw-dots type-circle justify-content-center mb-5" />
        </Swiper>
      </div>
    </section>
  );
}
