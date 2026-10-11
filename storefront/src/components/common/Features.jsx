"use client";

import { iconboxItems } from "@/data/features";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/translate";

// Static icon + order from data; title/description translate by item id
// (the data strings stay English as the fallback source of truth).
const FEATURE_COPY = {
  1: ["features.returns.title", "features.returns.description"],
  2: ["features.shipping.title", "features.shipping.description"],
  3: ["features.support.title", "features.support.description"],
  4: ["features.members.title", "features.members.description"],
};

export default function Features({ parentClass = "flat-spacing" }) {
  const countryCode = (usePathname() || "").split("/")[1] || "gb";
  const t = useT(countryCode);
  return (
    <section className={parentClass}>
      <div className="container">
        <Swiper
          dir="ltr"
          className="swiper tf-sw-iconbox"
          spaceBetween={15}
          breakpoints={{
            1200: { slidesPerView: 4 },
            768: { slidesPerView: 3 },
            576: { slidesPerView: 2 },
            0: { slidesPerView: 1 },
          }}
          modules={[Pagination]}
          pagination={{
            clickable: true,
            el: ".spd2",
          }}
        >
          {iconboxItems.map((item) => {
            const copy = FEATURE_COPY[item.id];
            return (
            <SwiperSlide key={item.id}>
              <div className="tf-icon-box">
                <div className="icon-box">
                  <span className={`icon ${item.icon}`} />
                </div>
                <div className="content text-center">
                  <h6>{copy ? t(copy[0]) : item.title}</h6>
                  <p className="text-secondary">{copy ? t(copy[1]) : item.description}</p>
                </div>
              </div>
            </SwiperSlide>
            );
          })}
          <div className="sw-pagination-iconbox spd2 sw-dots type-circle justify-content-center" />
        </Swiper>
      </div>
    </section>
  );
}
