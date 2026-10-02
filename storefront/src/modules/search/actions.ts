"use server"

import { Meilisearch } from "meilisearch"

import { SEARCH_FACETS } from "@lib/util/search-facets"

import {
  SEARCH_API_KEY,
  SEARCH_ENDPOINT,
  SEARCH_INDEX_NAME,
} from "@lib/search-client"

/**
 * Server-side search, used by the /results page.
 *
 * This is a second MeiliSearch client on purpose, and it is not a duplicate to
 * be consolidated away. `lib/search-client.ts` exports an InstantSearch
 * *adapter* built by `instantMeiliSearch`, which speaks InstantSearch's request
 * and response shape and is what the live-updating search modal needs. This
 * path wants a plain search against the index, so it uses the raw client. Both
 * read the same endpoint, key and index name from `lib/search-client.ts`, so
 * there is exactly one place to change any of those.
 *
 * Built once at module scope rather than per call. The constructor only stores
 * configuration, so this is not about cost; it is so a misconfigured endpoint
 * fails in one place instead of on every keystroke.
 */
const client = new Meilisearch({
  host: SEARCH_ENDPOINT,
  apiKey: SEARCH_API_KEY,
})

/**
 * Uses MeiliSearch to search for a query
 * @param {string} query - search query
 */
export async function search(query: string) {
  const { hits } = await client.index(SEARCH_INDEX_NAME).search(query)

  return hits
}

export type SearchFilters = {
  collections: string[]
  categories: string[]
  colors: string[]
  sizes: string[]
  tags: string[]
}

/** Facet attributes must be "use server"-clean: no value exports here. */

/**
 * Filtered + faceted search for the results page. Filter groups AND
 * together; values inside one group OR together. Returns hits plus the
 * facet distribution for the sidebar (counts intentionally omitted from
 * the UI — inventory depth stays private).
 */
export async function searchWithFacets(
  query: string,
  filters: SearchFilters
) {
  const andGroups: (string | string[])[] = []

  const orGroup = (attr: string, values: string[]) =>
    values.map((v) => `${attr} = "${v.replace(/"/g, "")}"`)

  if (filters.collections.length) {
    andGroups.push(orGroup("collection.handle", filters.collections))
  }
  if (filters.categories.length) {
    andGroups.push(orGroup("categories.handle", filters.categories))
  }
  if (filters.tags.length) {
    andGroups.push(orGroup("tags.value", filters.tags))
  }
  const optionValues = [...filters.colors, ...filters.sizes]
  if (optionValues.length) {
    andGroups.push(orGroup("variants.options.value", optionValues))
  }

  const res = await client.index(SEARCH_INDEX_NAME).search(query, {
    filter: andGroups.length ? andGroups : undefined,
    facets: SEARCH_FACETS,
  })

  return {
    hits: res.hits,
    facets: (res.facetDistribution || {}) as Record<string, Record<string, number>>,
  }
}
