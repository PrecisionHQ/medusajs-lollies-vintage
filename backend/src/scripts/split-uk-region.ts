import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { updateStoresStep } from "@medusajs/medusa/core-flows";
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
  updateRegionsWorkflow,
  updateShippingOptionsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * PR-01 — Split the UK out of the seed's EUR "Europe" region into its own GBP region.
 *
 * Why: the seed puts `gb` in a EUR region, so British shoppers are charged in euros.
 * Shopify parity = every presentment currency gets its own Medusa region
 * (a region holds exactly one `currency_code`). See SHOPIFY-PARITY.md PR9.
 *
 * Idempotent: safe to re-run. Run with:
 *   medusa exec ./src/scripts/split-uk-region.ts
 * Run against staging first, never against a DB you won't verify afterwards.
 *
 * Steps:
 *  1. Create "United Kingdom" region (gb, gbp) if missing.
 *  2. Remove "gb" from the Europe region so a country resolves to exactly one region.
 *  3. Ensure the gb tax region exists (seed already creates it — skipped if present).
 *  4. Append a GBP price to the existing Standard/Express shipping options
 *     (update replaces prices, so existing prices are preserved and re-sent).
 *  5. Backfill a GBP price on every variant from its EUR price (1:1 stub —
 *     PR-11 pricing matrix sets real GBP prices).
 *  6. Add gbp to the store's supported currencies.
 */

const GBP = "gbp";
const EUR = "eur";
const UK_COUNTRY = "gb";
// 1:1 stub ratio until PR-11 sets real GBP prices.
const EUR_TO_GBP_STUB = 1;
const SHIPPING_GBP_AMOUNT = 10;

type RegionRow = {
  id: string;
  name: string;
  currency_code: string;
  countries: { iso_2: string }[];
};

type VariantPriceRow = {
  id?: string;
  amount: number;
  currency_code: string;
  rules?: { attribute: string; operator: string; value: string }[];
};

type VariantRow = {
  id: string;
  product_id: string;
  prices: VariantPriceRow[];
};

type ShippingOptionRow = {
  id: string;
  name: string;
  prices: VariantPriceRow[];
};

const updateStoreCurrencies = createWorkflow(
  "split-uk-update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map(
          (currency) => ({
            currency_code: currency.currency_code,
            is_default: currency.is_default ?? false,
          })
        ),
      },
    }));

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function splitUkRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const storeModuleService = container.resolve(Modules.STORE);

  // --- 0. Read current regions ------------------------------------------------
  const { data: regions }: { data: RegionRow[] } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  });

  let ukRegion = regions.find(
    (r) =>
      r.currency_code === GBP &&
      r.countries.some((c) => c.iso_2 === UK_COUNTRY)
  );

  // --- 1. Create the UK region if missing --------------------------------------
  if (!ukRegion) {
    logger.info("Creating United Kingdom (gbp) region...");
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "United Kingdom",
            currency_code: GBP,
            countries: [UK_COUNTRY],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    ukRegion = {
      id: result[0].id,
      name: result[0].name,
      currency_code: GBP,
      countries: [{ iso_2: UK_COUNTRY }],
    };
    logger.info(`Created region ${ukRegion.id}.`);
  } else {
    logger.info(`UK region already exists (${ukRegion.id}) — skipping create.`);
  }

  // --- 2. Remove gb from any other region --------------------------------------
  const euRegion = regions.find(
    (r) =>
      r.id !== ukRegion!.id && r.countries.some((c) => c.iso_2 === UK_COUNTRY)
  );
  if (euRegion) {
    const remaining = euRegion.countries
      .map((c) => c.iso_2)
      .filter((c) => c !== UK_COUNTRY);
    logger.info(
      `Removing gb from region "${euRegion.name}" (keeps: ${remaining.join(", ")})...`
    );
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: euRegion.id },
        update: { countries: remaining },
      },
    });
    logger.info("Removed gb from Europe region.");
  } else {
    logger.info("No other region contains gb — skipping.");
  }

  // --- 3. Ensure the gb tax region exists ---------------------------------------
  const { data: taxRegions }: { data: { id: string; country_code: string }[] } =
    await query.graph({
      entity: "tax_region",
      fields: ["id", "country_code"],
      filters: { country_code: UK_COUNTRY },
    });
  if (!taxRegions.length) {
    logger.info("Creating gb tax region...");
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: UK_COUNTRY, provider_id: "tp_system" }],
    });
    logger.info("Created gb tax region.");
  } else {
    logger.info("gb tax region already exists — skipping.");
  }

  // --- 4. Append GBP prices to existing shipping options -------------------------
  const { data: shippingOptions }: { data: ShippingOptionRow[] } =
    await query.graph({
      entity: "shipping_option",
      fields: ["id", "name", "prices.*"],
    });
  const optionsNeedingGbp = shippingOptions.filter(
    (o) => !o.prices?.some((p) => p.currency_code === GBP)
  );
  if (optionsNeedingGbp.length) {
    logger.info(
      `Adding GBP prices to: ${optionsNeedingGbp.map((o) => o.name).join(", ")}...`
    );
    await updateShippingOptionsWorkflow(container).run({
      input: optionsNeedingGbp.map((o) => ({
        id: o.id,
        // Replace semantics: re-send existing prices plus the new GBP price.
        prices: [
          ...o.prices.map((p) => ({
            ...(p.id ? { id: p.id } : {}),
            amount: p.amount,
            currency_code: p.currency_code,
            ...(p.rules?.length ? { rules: p.rules } : {}),
          })),
          { amount: SHIPPING_GBP_AMOUNT, currency_code: GBP },
        ],
      })),
    });
    logger.info("GBP shipping prices added.");
  } else {
    logger.info("All shipping options already have GBP prices — skipping.");
  }

  // --- 5. Backfill GBP variant prices from EUR (1:1 stub) --------------------------
  const { data: variants }: { data: VariantRow[] } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id", "prices.*"],
  });
  const missing = variants.filter(
    (v) => !v.prices?.some((p) => p.currency_code === GBP)
  );
  logger.info(
    `${variants.length} variants found, ${missing.length} missing GBP prices.`
  );
  const CHUNK = 50;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK);
    await upsertVariantPricesWorkflow(container).run({
      input: {
        variantPrices: chunk.map((v) => {
          const eur = v.prices.find((p) => p.currency_code === EUR);
          const amount = Math.round((eur?.amount ?? 0) * EUR_TO_GBP_STUB);
          return {
            variant_id: v.id,
            product_id: v.product_id,
            prices: [{ amount, currency_code: GBP }],
          };
        }),
        previousVariantIds: [],
      },
    });
    logger.info(
      `Backfilled GBP prices for chunk ${i / CHUNK + 1}/${Math.ceil(missing.length / CHUNK)}.`
    );
  }

  // --- 6. Add gbp to the store's supported currencies ------------------------------
  const [store] = await storeModuleService.listStores();
  const supported = (store.supported_currencies ?? []) as {
    currency_code: string;
    is_default?: boolean;
  }[];
  if (!supported.some((c) => c.currency_code === GBP)) {
    logger.info("Adding gbp to store supported currencies...");
    await updateStoreCurrencies(container).run({
      input: {
        store_id: store.id,
        supported_currencies: [...supported, { currency_code: GBP }],
      },
    });
    // Touch the stores workflow import so the build keeps it referenced.
    logger.info("Store now supports gbp.");
  } else {
    logger.info("Store already supports gbp — skipping.");
  }

  logger.info("UK/GBP split complete. Verify in Admin: Regions, Taxes, Shipping, Prices.");
}
