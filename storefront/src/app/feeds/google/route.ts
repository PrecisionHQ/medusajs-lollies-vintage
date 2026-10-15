import { buildCatalogFeed } from "@lib/feeds/catalog-feed"

/**
 * Ads v1 — Product feed for Google Merchant Center AND Meta catalogs
 * (Meta ingests the Google RSS format directly, so one URL serves both —
 * paste it into Merchant Center > Products > Feeds and Meta Commerce
 * Manager > Catalogue > Data sources). Row shape lives in the shared
 * builder (also serving /feeds/tiktok).
 */
export async function GET() {
  return buildCatalogFeed()
}
