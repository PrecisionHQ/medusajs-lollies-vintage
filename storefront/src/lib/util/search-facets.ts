/**
 * Colour/size split for the `variants.options.value` facet.
 *
 * The Meilisearch index does not carry option TITLES (only values), so one
 * backend facet serves both groups. Values matching a standard apparel-size
 * token exactly (case-insensitive) are sizes; everything else is a colour.
 * Exact matching (no substrings) keeps colour names safe.
 */

/** Facet attributes requested from MeiliSearch (must stay filterable). */
export const SEARCH_FACETS = [
  "collection.handle",
  "categories.handle",
  "tags.value",
  "variants.options.value",
]

const SIZE_TOKENS = new Set(
  [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "2XL",
    "3XL",
    "4XL",
    "ONE SIZE",
    "ONESIZE",
    "OS",
    "FREE SIZE",
    "FREE",
    "SMALL",
    "MEDIUM",
    "LARGE",
    "EXTRA SMALL",
    "EXTRA LARGE",
    "0",
    "2",
    "4",
    "6",
    "8",
    "10",
    "12",
    "14",
    "16",
    "18",
    "20",
    "24",
    "26",
    "28",
    "30",
    "32",
    "34",
    "36",
    "38",
    "40",
    "42",
  ].map((t) => t.toUpperCase())
)

export function isSizeValue(value: string): boolean {
  return SIZE_TOKENS.has((value || "").trim().toUpperCase())
}

export function splitOptionValues(values: string[]): {
  colors: string[]
  sizes: string[]
} {
  const colors: string[] = []
  const sizes: string[] = []
  for (const v of values) {
    if (isSizeValue(v)) {
      if (!sizes.includes(v)) sizes.push(v)
    } else {
      if (!colors.includes(v)) colors.push(v)
    }
  }
  colors.sort((a, b) => a.localeCompare(b))
  return { colors, sizes }
}
