"use client";
import { collectionData } from "@/data/collections";
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Collection/category tiles. Accepts live tiles
 * ({id,title,href,imageSrc}) built server-side from Medusa
 * collections/categories; falls back to the static demo set when the
 * backend is unreachable or no merchandising data exists yet.
 *
 * Deliberately shows NO product counts — inventory depth stays private.
 *
 * layout: "slider" (swipe carousel, used by Explore Collections) or
 * "grid" (all tiles visible at once, used by Shop by Category).
 */
export function TileCard({ item }) {
  return (
    <div
      className="collection-position-2 style-3 hover-img wow fadeInUp"
      data-wow-delay={item.delay}
    >
      <Link href={item.href} className="img-style">
        <Image
          className="lazyload"
          data-src={item.imageSrc}
          alt={`banner-cls-${item.id}`}
          src={item.imageSrc}
          width={600}
          height={800}
        />
      </Link>
      <div className="content">
        <Link href={item.href} className="cls-btn">
          <h6 className="text">{item.title}</h6>
          <i className="icon icon-arrowUpRight" />
        </Link>
      </div>
    </div>
  );
}

export default function Categories({
  liveItems,
  title = "Explore Collections",
  layout = "slider",
  viewAllHref,
  viewAllLabel = "View All Collection",
}) {
  const pathname = usePathname();
  const countryCode = (pathname || "").split("/")[1] || "gb";

  const staticItems = collectionData.map((item) => ({
    id: item.id,
    title: item.title,
    href: `/${countryCode}/store`,
    imageSrc: item.imageSrc,
    delay: item.delay,
  }));

  const list =
    liveItems && liveItems.length
      ? liveItems.map((item, i) => ({ ...item, delay: `${(i % 5) * 0.1}s` }))
      : staticItems;

  return (
    <section className="flat-spacing">
      <div className="container">
        <div className="heading-section-2 wow fadeInUp">
          <h3 className="heading">{title}</h3>
          <Link href={viewAllHref || `/${countryCode}/store`} className="btn-line py_8">
            {viewAllLabel}
          </Link>
        </div>
      </div>
      {layout === "grid" ? (
        <div className="container">
          <div className="cat-grid">
            {list.map((item) => (
              <TileCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="container-full slider-layout-right">
          <Swiper
            className="swiper tf-sw-collection"
            spaceBetween={15}
            loop={true}
            breakpoints={{
              1024: {
                slidesPerView: 5.1,
                spaceBetween: 20,
              },
              768: {
                slidesPerView: 3.1,
                spaceBetween: 20,
              },
              0: {
                slidesPerView: 2.1,
                spaceBetween: 15,
              },
            }}
            dir="ltr"
          >
            {list.map((item) => (
              <SwiperSlide key={item.id}>
                <TileCard item={item} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </section>
  );
}
