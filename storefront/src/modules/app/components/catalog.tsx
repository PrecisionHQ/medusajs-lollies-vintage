"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"
import { money } from "@modules/app/components/ui"

type Variant = {
  id: string
  title?: string
  sku?: string | null
  barcode?: string | null
  product_id?: string
  prices?: { id?: string; currency_code?: string; amount?: number }[]
  inventory_items?: { inventory_item_id?: string; inventory_item?: { id?: string } }[]
}

type Level = {
  id: string
  location_id: string
  stocked_quantity?: number
}

type Location = { id: string; name?: string }

const pickItemId = (v: Variant): string | null =>
  v.inventory_items?.[0]?.inventory_item_id ??
  v.inventory_items?.[0]?.inventory_item?.id ??
  null

/**
 * Catalog — find a variant (text search, SKU/barcode, camera scan) and fix
 * it: price edit, stock adjust, publish toggle. Pure PWA UI over Medusa
 * core /admin/* (see docs/parity-spike.md).
 *
 * Stock adjust is absolute under the hood (levels only take a set
 * stocked_quantity), so the UI reads the level first and writes
 * current + delta. Price edits send the full price array with the edited
 * row merged, keeping the other currencies untouched.
 */
export default function Catalog({
  onAuthLost,
  target,
  onTargetDone,
}: {
  onAuthLost: () => void
  target: string | null
  onTargetDone: () => void
}) {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<Variant[]>([])
  const [selected, setSelected] = useState<Variant | null>(null)
  const [product, setProduct] = useState<{ id: string; title?: string; status?: string } | null>(null)
  const [levels, setLevels] = useState<Level[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState("")
  const [delta, setDelta] = useState("1")
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({})
  const [newCurrency, setNewCurrency] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof AppAuthError) {
        onAuthLost()
        return
      }
      setError(e instanceof Error ? e.message : "Could not load.")
    },
    [onAuthLost]
  )

  const search = useCallback(
    async (term: string) => {
      const t = term.trim()
      if (!t) {
        setRows([])
        return
      }
      setBusy("search")
      setError(null)
      try {
        // Exact paths first (id/sku/barcode filters exist on the endpoint),
        // falling back to free-text q when nothing matches.
        let found: Variant[] = []
        for (const filter of [`id=${encodeURIComponent(t)}`, `sku=${encodeURIComponent(t)}`, `barcode=${encodeURIComponent(t)}`]) {
          const r = await appFetch<{ variants: Variant[] }>(
            `/admin/product-variants?limit=10&${filter}&fields=id,title,sku,barcode,product_id,prices,*inventory_items`
          )
          if ((r.variants ?? []).length) {
            found = r.variants
            break
          }
        }
        if (!found.length) {
          const r = await appFetch<{ variants: Variant[] }>(
            `/admin/product-variants?limit=20&q=${encodeURIComponent(t)}&fields=id,title,sku,barcode,product_id,prices,*inventory_items`
          )
          found = r.variants ?? []
        }
        setRows(found)
        if (!found.length) setError("No variant matches that search.")
      } catch (e) {
        fail(e)
      } finally {
        setBusy(null)
      }
    },
    [fail]
  )

  const openVariant = useCallback(
    async (v: Variant) => {
      setBusy(v.id)
      setError(null)
      try {
        const [prod, locs] = await Promise.all([
          v.product_id
            ? appFetch<{ product: { id: string; title?: string; status?: string } }>(
                `/admin/products/${v.product_id}?fields=id,title,status`
              ).catch(() => null)
            : Promise.resolve(null),
          appFetch<{ stock_locations: Location[] }>(
            "/admin/stock-locations?limit=50&fields=id,name"
          ).catch(() => ({ stock_locations: [] })),
        ])
        setSelected(v)
        setProduct(prod?.product ?? null)
        setLocations(locs.stock_locations ?? [])
        setLocationId((locs.stock_locations ?? [])[0]?.id ?? "")
        setPriceEdits({})
        const itemId = pickItemId(v)
        if (itemId) {
          const lv = await appFetch<{ inventory_levels: Level[] }>(
            `/admin/inventory-items/${itemId}/location-levels?fields=id,location_id,stocked_quantity`
          ).catch(() => ({ inventory_levels: [] }))
          setLevels(lv.inventory_levels ?? [])
        } else {
          setLevels([])
        }
      } catch (e) {
        fail(e)
      } finally {
        setBusy(null)
      }
    },
    [fail]
  )

  // Jump target from the Status board's stock alerts.
  useEffect(() => {
    if (!target) return
    appFetch<{ variants: Variant[] }>(
      `/admin/product-variants?limit=1&id=${encodeURIComponent(target)}&fields=id,title,sku,barcode,product_id,prices,*inventory_items`
    )
      .then((r) => {
        if (r.variants?.[0]) openVariant(r.variants[0])
        else setError("That variant is gone — it may have been deleted.")
      })
      .catch(fail)
      .finally(onTargetDone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const stopScan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopScan(), [stopScan])

  const scan = async () => {
    const Detector = (window as any).BarcodeDetector
    if (!Detector) {
      setError("This browser cannot scan — type or paste the barcode instead.")
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      setScanning(true)
      // Wait a tick for the <video> to mount, then attach + poll.
      setTimeout(async () => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] })
        const tick = async () => {
          if (!videoRef.current || !streamRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes?.[0]?.rawValue) {
              const value = String(codes[0].rawValue)
              setQuery(value)
              stopScan()
              search(value)
              return
            }
          } catch {
            // Detection hiccups are transient; keep polling.
          }
          setTimeout(tick, 400)
        }
        tick()
      }, 100)
    } catch {
      setError("Camera unavailable — type or paste the barcode instead.")
    }
  }

  const adjust = async (d: number) => {
    if (!selected) return
    const itemId = pickItemId(selected)
    const level = levels.find((l) => l.location_id === locationId) ?? levels[0]
    if (!itemId || !level) {
      setError("No stock level here to adjust.")
      return
    }
    const next = Number(level.stocked_quantity ?? 0) + d
    if (next < 0) {
      setError("Stock cannot go below 0.")
      return
    }
    setBusy("adjust")
    setError(null)
    try {
      await appFetch(`/admin/inventory-items/${itemId}/location-levels/batch`, {
        method: "POST",
        body: JSON.stringify({
          update: [
            {
              id: level.id,
              location_id: level.location_id,
              inventory_item_id: itemId,
              stocked_quantity: next,
            },
          ],
        }),
      })
      await openVariant(selected)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const savePrice = async (currency: string, priceId?: string) => {
    if (!selected?.product_id) return
    const raw = (priceEdits[currency] ?? "").replace(",", ".")
    const major = Number(raw)
    if (!Number.isFinite(major) || major < 0) {
      setError("Enter a valid price.")
      return
    }
    setBusy(`price-${currency}`)
    setError(null)
    try {
      const rest = (selected.prices ?? []).filter(
        (p) => (p.currency_code ?? "").toLowerCase() !== currency.toLowerCase()
      )
      await appFetch(
        `/admin/products/${selected.product_id}/variants/${selected.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            prices: [
              ...rest.map((p) => ({
                ...(p.id ? { id: p.id } : {}),
                currency_code: p.currency_code,
                amount: p.amount,
              })),
              {
                ...(priceId ? { id: priceId } : {}),
                currency_code: currency.toLowerCase(),
                amount: Math.round(major * 100),
              },
            ],
          }),
        }
      )
      const r = await appFetch<{ variants: Variant[] }>(
        `/admin/product-variants?limit=1&id=${selected.id}&fields=id,title,sku,barcode,product_id,prices,*inventory_items`
      )
      if (r.variants?.[0]) {
        setSelected(r.variants[0])
        const idx = rows.findIndex((x) => x.id === selected.id)
        if (idx >= 0) {
          setRows((rs) => rs.map((x) => (x.id === selected.id ? r.variants[0] : x)))
        }
      }
      setPriceEdits((e) => {
        const next = { ...e }
        delete next[currency]
        return next
      })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const togglePublish = async () => {
    if (!product) return
    const next = product.status === "published" ? "draft" : "published"
    setBusy("publish")
    setError(null)
    try {
      const r = await appFetch<{ product: { status?: string } }>(
        `/admin/products/${product.id}`,
        { method: "POST", body: JSON.stringify({ status: next }) }
      )
      setProduct({ ...product, status: r.product?.status ?? next })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const level = levels.find((l) => l.location_id === locationId) ?? levels[0]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <h2 className="la-h2">Find item</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="la-input"
            placeholder="Name, SKU or barcode"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search(query)
            }}
          />
          <button className="la-btn-ghost" disabled={busy !== null} onClick={() => search(query)}>
            Go
          </button>
          <button className="la-btn-ghost" disabled={busy !== null} onClick={scanning ? stopScan : scan}>
            {scanning ? "Stop" : "Scan"}
          </button>
        </div>
        {scanning ? (
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 10, marginTop: 8 }} />
        ) : null}
        {error && !selected ? <p className="la-err">{error}</p> : null}
        {rows.map((v) => (
          <div key={v.id} className="la-item">
            <button
              className="la-btn-ghost"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => openVariant(v)}
            >
              {[v.title, v.sku].filter(Boolean).join(" · ")}
              <br />
              <span className="la-muted">
                {(v.prices ?? [])
                  .map((p) => money(Number(p.amount ?? 0), p.currency_code ?? "eur"))
                  .join(" · ") || "no price"}
              </span>
            </button>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="la-card">
          <div className="la-row">
            <h2 className="la-h2">{[product?.title, selected.title].filter(Boolean).join(" / ") || "Item"}</h2>
            <button className="la-btn-ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p className="la-muted">
            {[selected.sku ? `SKU ${selected.sku}` : "", selected.barcode ? `BAR ${selected.barcode}` : "", product?.status ?? ""].filter(Boolean).join(" · ")}
          </p>
          {error ? <p className="la-err">{error}</p> : null}

          <div className="la-item">
            <p><strong>Prices</strong></p>
            {(selected.prices ?? []).map((p) => {
              const cur = (p.currency_code ?? "eur").toLowerCase()
              return (
                <div key={p.id ?? cur} className="la-row" style={{ marginBottom: 8 }}>
                  <span style={{ minWidth: 52 }}>{cur.toUpperCase()}</span>
                  <input
                    className="la-input"
                    inputMode="decimal"
                    placeholder={((Number(p.amount ?? 0) / 100).toFixed(2))}
                    value={priceEdits[cur] ?? ""}
                    onChange={(e) => setPriceEdits((m) => ({ ...m, [cur]: e.target.value }))}
                  />
                  <button
                    className="la-btn-ghost"
                    disabled={busy !== null || !(priceEdits[cur] ?? "").trim()}
                    onClick={() => savePrice(cur, p.id)}
                  >
                    Set
                  </button>
                </div>
              )
            })}
            <div className="la-row">
              <input
                className="la-input"
                placeholder="eur"
                maxLength={3}
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                style={{ maxWidth: 80 }}
              />
              <input
                className="la-input"
                inputMode="decimal"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
              <button
                className="la-btn-ghost"
                disabled={busy !== null || !newCurrency.trim() || !newAmount.trim()}
                onClick={() => {
                  setPriceEdits((m) => ({ ...m, [newCurrency.trim().toLowerCase()]: newAmount }))
                  setNewCurrency("")
                  setNewAmount("")
                }}
              >
                Add
              </button>
            </div>
            <p className="la-muted" style={{ fontSize: 12 }}>Add stages a new currency row above — tap Set to save it.</p>
          </div>

          <div className="la-item">
            <p>
              <strong>Stock</strong>{" "}
              <span className="la-muted">
                {level ? `${level.stocked_quantity ?? 0} @ ${(locations.find((l) => l.id === level.location_id)?.name) ?? level.location_id.slice(-4)}` : "no level here"}
              </span>
            </p>
            {locations.length > 1 ? (
              <select
                className="la-input"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                aria-label="Stock location"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name ?? l.id}</option>
                ))}
              </select>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {[-5, -1, 1, 5].map((d) => (
                <button
                  key={d}
                  className="la-btn-ghost"
                  style={{ flex: 1 }}
                  disabled={busy !== null}
                  onClick={() => adjust(d)}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
              <input
                className="la-input"
                inputMode="numeric"
                placeholder="±n"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                style={{ maxWidth: 72 }}
              />
              <button
                className="la-btn-ghost"
                disabled={busy !== null}
                onClick={() => {
                  const d = Number(delta.replace(",", "."))
                  if (Number.isInteger(d) && d !== 0) adjust(d)
                  else setError("Enter a whole-number adjustment.")
                }}
              >
                Apply
              </button>
            </div>
          </div>

          {product ? (
            <div className="la-actions">
              <button className="la-btn-ghost" disabled={busy !== null} onClick={togglePublish} style={{ width: "100%" }}>
                {product.status === "published" ? "Unpublish (hide from shop)" : "Publish to shop"}
              </button>
            </div>
          ) : null}
          {busy ? <p className="la-muted">Working…</p> : null}
        </div>
      ) : null}
    </div>
  )
}
