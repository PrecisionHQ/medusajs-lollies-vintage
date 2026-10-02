"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import ProductCard1 from "@/components/productCards/ProductCard1";

/**
 * Client carousel for related product cards (server-fetched upstream).
 */
export default function ModaveRelatedCarousel({ cards }) {
  if (!cards?.length) return null;
  return (
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
      pagination={{ clickable: true, el: ".spd-rel" }}
    >
      {cards.map((card) => (
        <SwiperSlide key={card.id} className="swiper-slide">
          <ProductCard1 product={card} />
        </SwiperSlide>
      ))}
      <div className="sw-pagination-latest spd-rel sw-dots type-circle justify-content-center" />
    </Swiper>
  );
}
