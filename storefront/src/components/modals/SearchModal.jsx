"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { search } from "@modules/search/actions";

const POPULAR = [
  { label: "Dresses", href: "dresses", kind: "category" },
  { label: "Bridal", href: "bridal", kind: "collection" },
  { label: "New In", href: "new-in", kind: "collection" },
  { label: "Sale", href: "sale", kind: "category" },
  { label: "Maxi Dresses", href: "maxi-dresses", kind: "category" },
];

/**
 * Header search modal: live suggestions from MeiliSearch as you type,
 * submit jumps to the full results page (with facets). Popular links go
 * to real categories/collections.
 */
export default function SearchModal() {
  const pathname = usePathname();
  const router = useRouter();
  const countryCode = (pathname || "").split("/")[1] || "gb";
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const hits = await search(q);
        setSuggestions((hits || []).slice(0, 6));
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  const go = (q) => {
    const query = (q ?? value).trim();
    if (!query) return;
    setSuggestions([]);
    router.push(`/${countryCode}/results/${encodeURIComponent(query)}`);
  };

  return (
    <div className="modal fade modal-search" id="search">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="d-flex justify-content-between align-items-center">
            <h5>Search</h5>
            <span
              className="icon-close icon-close-popup"
              data-bs-dismiss="modal"
            />
          </div>
          <form
            className="form-search"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <fieldset className="text">
              <input
                type="text"
                placeholder="Searching..."
                className=""
                name="text"
                tabIndex={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-required="true"
              />
            </fieldset>
            <button className="" type="submit">
              <svg
                className="icon"
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                  stroke="#181818"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21.35 21.0004L17 16.6504"
                  stroke="#181818"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
          {suggestions.length > 0 && (
            <div className="mt-3">
              {suggestions.map((hit) => (
                <Link
                  key={hit.id || hit.handle}
                  href={`/${countryCode}/products/${hit.handle}`}
                  className="d-flex align-items-center gap-2 mb-2 link"
                  onClick={() => setSuggestions([])}
                >
                  {hit.thumbnail ? (
                    <Image
                      src={hit.thumbnail}
                      alt={hit.title}
                      width={48}
                      height={64}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                    />
                  ) : null}
                  <span className="text-line-clamp-1">{hit.title}</span>
                </Link>
              ))}
            </div>
          )}
          <div>
            <h5 className="mb_16">Popular right now</h5>
            <ul className="list-tags">
              {POPULAR.map((p) => (
                <li key={p.href}>
                  <Link
                    href={`/${countryCode}/${
                      p.kind === "collection" ? "collections" : "categories"
                    }/${p.href}`}
                    className="radius-60 link"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
