/**
 * JSON-LD script renderer (server-safe, no JS). Data comes from the pure
 * builders in @lib/util/seo-jsonld so the markup is unit-testable without
 * rendering.
 */
export default function JsonLd({ data }: { data: unknown }) {
  if (!data) return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
