"use client";
import ProductCard1 from "@/components/productCards/ProductCard1";
import { products } from "@/data/products";
import React from "react";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

export default function Products2({
  title = "Best Selling",
  parentClass = "",
  liveItems,
}) {
  // Same live-first, static-fallback contract as the elegantAbode Products
  // section. The preview passes the second page of live products here.
  const list =
    liveItems && liveItems.length ? liveItems : products.slice(4);
  return (
    <section className={parentClass}>
      <div className="container">
        <div className="heading-section text-center wow fadeInUp">
          <h3 className="heading">{title}</h3>
          <p className="subheading text-secondary">
            Browse our Top Trending: the hottest picks loved by all.
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
            el: ".spd4",
          }}
        >
          {list.map((product, i) => (
            <SwiperSlide key={product.id ?? i} className="swiper-slide">
              <ProductCard1 product={product} />
            </SwiperSlide>
          ))}

          <div className="sw-pagination-latest spd4  sw-dots type-circle justify-content-center" />
        </Swiper>
      </div>
    </section>
  );
}
