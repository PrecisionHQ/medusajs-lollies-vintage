import { search } from '@medusajs/utils'
import {
  defineProductSearchIndex,
  PRODUCT_GRAPH_FIELDS,
  productSearchSchema,
} from '@rokmohar/medusa-plugin-meilisearch/indexes'

/**
 * Declares the `products` search index.
 *
 * Everything in this directory is loaded before the app boots and handed to
 * the Search Module, which owns the index from there: `medusa db:migrate`
 * creates it in Meilisearch, the module seeds it on first boot, and catalog
 * events keep it current. There is no indexing code to run and no startup
 * sync job to wait for.
 *
 * On top of the factory default (id, title, handle, thumbnail, description,
 * collection, categories, tags, variants) this adds variant OPTIONS
 * (Size, Color, ...) so shoppers can search by color and other option
 * values, and filter/facet on them. The option-bearing attributes are:
 * - searchable: option values match text queries ("black" finds Black
 *   variants even when the variant title convention changes).
 * - filterable: `variants.options.value` supports Meili filters, which the
 *   storefront (or API consumers) can use for faceted browsing later.
 *
 * After changing this file, redeploy and run a full reindex:
 *   POST /admin/meilisearch/sync
 * Settings (searchable/filterable lists) are re-applied by the sync.
 */
const baseSchema = productSearchSchema()

export default defineProductSearchIndex({
  graph_fields: [...PRODUCT_GRAPH_FIELDS, 'variants.options.value'],
  fields: search.define({
    ...baseSchema,
    variants: search.object({
      id: search.keyword().filterable(),
      title: search.text().searchable({ weight: 2 }),
      sku: search.text().searchable({ weight: 4 }).filterable(),
      barcode: search.keyword().filterable(),
      options: search
        .object({
          value: search.text().searchable().filterable(),
        })
        .array(),
    }),
  }),
})
