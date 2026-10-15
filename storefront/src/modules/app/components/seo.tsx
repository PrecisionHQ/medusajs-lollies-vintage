"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Product = {
  id: string
  title?: string | null
  handle?: string | null
  thumbnail?: string | null
  description?: string | null
  status?: string | null
}

const descLen = (p: Product) => (p.description ?? "").replace(/<[^>]*>/g, "").trim().length

/**
 * SEO — client-computed health mirroring the dashboard page: missing
 * images, missing/thin descriptions. Fixing happens on the dashboard
 * (rich editing isn't a phone task); this tab answers 'how bad is it'.
 */
export default function Seo({ onAuthLost }: { onAuthLost: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const all: Product[] = []
      let offset = 0
      for (let page = 0; page < 5; page++) {
        const res = await appFetch<{ products: Product[] }>(
          `/admin/products?limit=100&offset=${offset}&fields=id,title,handle,thumbnail,description,status`
        )
        if (!res.products?.length) break
        all.push(...res.products)
        offset += res.products.length
      }
      setProducts(all)
      setError(null)
    } catch (e) {
      if (e instanceof AppAuthError) onAuthLost()
      else setError(e instanceof Error ? e.message : "Could not load.")
    } finally {
      setLoading(false)
    }
  }, [onAuthLost])

  useEffect(() => {
    load()
  }, [load])

  const live = products.filter((p) => p.status === "published")
  const noImage = live.filter((p) => !p.thumbnail)
  const thin = live.filter((p) => descLen(p) < 100)
  const worst = [...noImage, ...thin.filter((p) => !noImage.includes(p))].slice(0, 20)

  return (
    <div className="la-card">
      <div className="la-row">
        <h2 className="la-h2">SEO health</h2>
        <button className="la-btn-ghost" onClick={load}>Refresh</button>
      </div>
      {loading ? <p className="la-muted">Loading…</p> : null}
      {error ? <p className="la-err">{error}</p> : null}
      {!loading && !error ? (
        <p>
          {live.length} live · <strong>{noImage.length}</strong> no image ·{" "}
          <strong>{thin.length}</strong> thin description
        </p>
      ) : null}
      {worst.map((p) => (
        <p key={p.id} style={{ fontSize: 14 }}>
          {p.title ?? p.handle}
          <br />
          <span className="la-muted">
            {[
              !p.thumbnail ? "no image" : "",
              descLen(p) === 0 ? "no description" : descLen(p) < 100 ? "thin description" : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
      ))}
    </div>
  )
}
