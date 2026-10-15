import { buildCatalogFeed } from "@lib/feeds/catalog-feed"

/**
 * Phase 3 (C2) — TikTok catalog feed. TikTok Business Center ingests the
 * Google Shopping RSS template via scheduled fetch, so this serves the
 * shared builder: Catalog > Products > Add products > Data feed >
 * scheduled fetch, paste this URL. Same rows as Google/Meta (one per
 * variant, gb-priced, identifier_exists=no).
 */
export async function GET() {
  return buildCatalogFeed()
}
