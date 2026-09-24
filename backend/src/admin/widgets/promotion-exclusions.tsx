import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * Exclusion-list editor, injected into the side column of every promotion
 * details page. Products on the list are skipped by this promotion via
 * one `ne` target rule per product on `items.product.id` (managed by the
 * `/admin/promotions/:id/exclusions` API route). Nothing is hardcoded to a
 * particular code or discount value.
 */

type ExcludedProduct = { id: string; title: string }
type PromotionData = { id: string; code?: string | null }

const AUTH_TOKEN_KEY = "medusa_auth_token"

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
  } catch {
    // localStorage unavailable; fall back to the session cookie below.
  }
  return headers
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (body as { message?: string }).message ?? `Request failed (${res.status})`
    )
  }
  return body as T
}

const PromotionExclusionsWidget = ({
  data,
}: DetailWidgetProps<PromotionData>) => {
  const promotionId = data.id

  const [excluded, setExcluded] = useState<ExcludedProduct[]>([])
  const [hasMethod, setHasMethod] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ExcludedProduct[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api<{
      excluded_products: ExcludedProduct[]
      has_application_method: boolean
    }>(`/admin/promotions/${promotionId}/exclusions`)
      .then((body) => {
        if (cancelled) {
          return
        }
        setExcluded(body.excluded_products)
        setHasMethod(body.has_application_method)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [promotionId])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      api<{ products: ExcludedProduct[] }>(
        `/admin/products?q=${encodeURIComponent(
          query.trim()
        )}&fields=id,title&limit=8`
      )
        .then((body) => setResults(body.products ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const excludedIds = new Set(excluded.map((p) => p.id))

  const addProduct = (product: ExcludedProduct) => {
    if (!excludedIds.has(product.id)) {
      setExcluded((prev) => [...prev, product])
    }
    setQuery("")
    setResults([])
    setNotice(null)
  }

  const removeProduct = (id: string) => {
    setExcluded((prev) => prev.filter((p) => p.id !== id))
    setNotice(null)
  }

  const save = () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    api<{ excluded_products: ExcludedProduct[] }>(
      `/admin/promotions/${promotionId}/exclusions`,
      {
        method: "POST",
        body: JSON.stringify({ product_ids: excluded.map((p) => p.id) }),
      }
    )
      .then((body) => {
        setExcluded(body.excluded_products)
        setNotice(
          body.excluded_products.length
            ? `Excluding ${body.excluded_products.length} product(s) from this promotion.`
            : "Exclusion list cleared. This promotion applies to all items again."
        )
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false))
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Excluded products</Heading>
      </div>
      <div className="px-6 py-4">
        {loading ? (
          <Text className="text-ui-fg-subtle">Loading exclusion list…</Text>
        ) : !hasMethod ? (
          <Text className="text-ui-fg-subtle">
            Save the promotion details first, then manage exclusions here.
          </Text>
        ) : (
          <div className="flex flex-col gap-y-3">
            <Text className="text-ui-fg-subtle">
              Products on this list are skipped by
              {data.code ? ` ${data.code}` : " this promotion"}, even when
              its other rules match.
            </Text>

            {excluded.length > 0 ? (
              <ul className="flex flex-col gap-y-1">
                {excluded.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-x-2 py-1"
                  >
                    <Text>{product.title}</Text>
                    <Button
                      variant="transparent"
                      size="small"
                      onClick={() => removeProduct(product.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="text-ui-fg-subtle">
                No exclusions. The promotion applies to all matching items.
              </Text>
            )}

            <Input
              placeholder="Type at least 2 characters to search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <Text className="text-ui-fg-subtle">Searching…</Text>
            )}
            {!searching && results.length > 0 && (
              <ul className="flex flex-col gap-y-1">
                {results
                  .filter((p) => !excludedIds.has(p.id))
                  .map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center justify-between gap-x-2 py-1"
                    >
                      <Text>{product.title}</Text>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={() => addProduct(product)}
                      >
                        Add
                      </Button>
                    </li>
                  ))}
              </ul>
            )}

            {error && <Text className="text-ui-fg-error">{error}</Text>}
            {notice && <Text className="text-ui-fg-subtle">{notice}</Text>}

            <div>
              <Button
                variant="secondary"
                size="small"
                onClick={save}
                isLoading={saving}
                disabled={saving}
              >
                Save exclusions
              </Button>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "promotion.details.side",
})

export default PromotionExclusionsWidget
