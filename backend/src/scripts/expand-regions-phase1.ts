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
 * PR-10 — Phase-1 region expansion: Nordics + Switzerland.
 *
 * Same pattern as PR-01 (split-uk-region.ts): every presentment currency gets
 * its own region (Medusa holds exactly one currency per region). Phasing
 * locked after the region-parity grill (see PR-PLAN/PR-16 notes):
 *  - Phase 1 (this script): DK→DKK, SE→SEK, NO→NOK, CH→CHF. Same warehouse,
 *    same tax logic, same support languages. Pure revenue.
 *  - Phase 2 (later script): US→USD, CA→CAD, AU→AUD. Needs the US-nexus tax
 *    trigger armed (PR-09 plan), otherwise same shape.
 *  - Phase 3 (later script): AE→AED, SG→SGD, JP→JPY. Payout accounts per
 *    currency required first (Stripe settles ~20 currencies).
 *  - Africa/LatAm/MENA-broad: demand-led, starting from a USD Rest-of-World
 *    stopgap — NOT blanket coverage. Each live region is a tax, logistics
 *    and support commitment, not a config line.
 *
 * Idempotent: safe to re-run. Run with:
 *   medusa exec ./src/scripts/expand-regions-phase1.ts
 * Run against staging first.
 *
 * Money notes (all stubs until PR-11 sets real prices):
 *  - Variant backfill uses the FX map below (documented approximations).
 *  - Shipping uses flat per-currency equivalents of ~€10 (PR-12 replaces
 *    with table rates).
 */

type PhaseRegion = {
  name: string;
  currency: string;
  countries: string[];
  /** Approximate EUR→currency rate for the price backfill stub. */
  eurRate: number;
  /** Flat shipping equivalent of ~€10 in minor units. */
  shippingAmount: number;
};

const PHASE_1: PhaseRegion[] = [
  { name: "Denmark", currency: "dkk", countries: ["dk"], eurRate: 7.46, shippingAmount: 75 },
  { name: "Sweden", currency: "sek", countries: ["se"], eurRate: 11.3, shippingAmount: 110 },
  { name: "Norway", currency: "nok", countries: ["no"], eurRate: 11.7, shippingAmount: 110 },
  { name: "Switzerland", currency: "chf", countries: ["ch"], eurRate: 0.95, shippingAmount: 10 },
];

type RegionRow = {
  id: string;
  name: string;
  currency_code: string;
  countries: { iso_2: string }[];
};

type PriceRow = {
  id?: string;
  amount: number;
  currency_code: string;
  rules?: { attribute: string; operator: string; value: string }[];
};

const updateStoreCurrencies = createWorkflow(
  "phase1-update-store-currencies",
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

export default async function expandRegionsPhase1({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const storeModuleService = container.resolve(Modules.STORE);

  const { data: regions }: { data: RegionRow[] } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  });

  for (const phase of PHASE_1) {
    const exists = regions.find(
      (r) =>
        r.currency_code === phase.currency &&
        phase.countries.every((c) => r.countries.some((rc) => rc.iso_2 === c))
    );
    if (!exists) {
      logger.info(`Creating region ${phase.name} (${phase.currency})...`);
      const { result } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: phase.name,
              currency_code: phase.currency,
              countries: phase.countries,
              payment_providers: ["pp_system_default"],
            },
          ],
        },
      });
      regions.push({
        id: result[0].id,
        name: result[0].name,
        currency_code: phase.currency,
        countries: phase.countries.map((iso_2) => ({ iso_2 })),
      });
      logger.info(`Created region ${result[0].id}.`);
    } else {
      logger.info(
        `Region ${phase.name} already exists (${exists.id}) — skipping create.`
      );
    }

    // Remove these countries from any other region (one country, one region).
    for (const other of regions.filter(
      (r) =>
        r.currency_code !== phase.currency &&
        r.countries.some((c) => phase.countries.includes(c.iso_2))
    )) {
      const remaining = other.countries
        .map((c) => c.iso_2)
        .filter((c) => !phase.countries.includes(c));
      logger.info(
        `Removing ${phase.countries.join(",")} from "${other.name}"...`
      );
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: other.id }, update: { countries: remaining } },
      });
      other.countries = other.countries.filter(
        (c) => !phase.countries.includes(c.iso_2)
      );
    }

    // Tax regions (per country; skip existing).
    const { data: taxRegions }: { data: { country_code: string }[] } =
      await query.graph({
        entity: "tax_region",
        fields: ["country_code"],
        filters: { country_code: phase.countries },
      });
    const have = new Set((taxRegions ?? []).map((t) => t.country_code));
    const missing = phase.countries.filter((c) => !have.has(c));
    if (missing.length) {
      await createTaxRegionsWorkflow(container).run({
        input: missing.map((country_code) => ({
          country_code,
          provider_id: "tp_system",
        })),
      });
      logger.info(`Created tax regions for ${missing.join(",")}.`);
    }

    // Shipping: append a flat price in the new currency (replace semantics —
    // existing prices are re-sent).
    const { data: options }: { data: { id: string; name: string; prices: PriceRow[] }[] } =
      await query.graph({
        entity: "shipping_option",
        fields: ["id", "name", "prices.*"],
      });
    const needing = (options ?? []).filter(
      (o) => !o.prices?.some((p) => p.currency_code === phase.currency)
    );
    if (needing.length) {
      await updateShippingOptionsWorkflow(container).run({
        input: needing.map((o) => ({
          id: o.id,
          prices: [
            ...o.prices.map((p) => ({
              ...(p.id ? { id: p.id } : {}),
              amount: p.amount,
              currency_code: p.currency_code,
              ...(p.rules?.length ? { rules: p.rules } : {}),
            })),
            { amount: phase.shippingAmount, currency_code: phase.currency },
          ],
        })),
      });
      logger.info(
        `Added ${phase.currency} shipping prices to ${needing.length} options.`
      );
    }

    // Variant price backfill from EUR via the stub FX rate.
    const { data: variants }: { data: { id: string; product_id: string; prices: PriceRow[] }[] } =
      await query.graph({
        entity: "product_variant",
        fields: ["id", "product_id", "prices.*"],
      });
    const lacking = (variants ?? []).filter(
      (v) => !v.prices?.some((p) => p.currency_code === phase.currency)
    );
    logger.info(
      `${phase.currency}: ${lacking.length}/${(variants ?? []).length} variants need prices.`
    );
    const CHUNK = 50;
    for (let i = 0; i < lacking.length; i += CHUNK) {
      await upsertVariantPricesWorkflow(container).run({
        input: {
          variantPrices: lacking.slice(i, i + CHUNK).map((v) => {
            const eur = v.prices.find((p) => p.currency_code === "eur");
            return {
              variant_id: v.id,
              product_id: v.product_id,
              prices: [
                {
                  amount: Math.round((eur?.amount ?? 0) * phase.eurRate),
                  currency_code: phase.currency,
                },
              ],
            };
          }),
          previousVariantIds: [],
        },
      });
    }
  }

  // Store-level currencies.
  const [store] = await storeModuleService.listStores();
  const supported = (store.supported_currencies ?? []) as {
    currency_code: string;
    is_default?: boolean;
  }[];
  const missingCurrencies = PHASE_1.map((p) => p.currency).filter(
    (c) => !supported.some((s) => s.currency_code === c)
  );
  if (missingCurrencies.length) {
    await updateStoreCurrencies(container).run({
      input: {
        store_id: store.id,
        supported_currencies: [
          ...supported,
          ...missingCurrencies.map((currency_code) => ({ currency_code })),
        ],
      },
    });
    logger.info(`Store now supports: ${missingCurrencies.join(", ")}.`);
  }

  logger.info(
    "Phase-1 expansion complete. Verify in Admin, then set REAL prices (PR-11) and table rates (PR-12)."
  );
}
