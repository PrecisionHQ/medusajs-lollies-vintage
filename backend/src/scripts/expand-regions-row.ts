import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * P11-global — Rest-of-World region: every ISO country not covered by
 * another region joins a single EUR "Rest of World" region (per decision:
 * EUR pricing worldwide in v1, Phase-1 currency splits dropped).
 *
 * The storefront is fully data-driven off /store/regions, so countries
 * added here go live with zero storefront deploy. Display language comes
 * from storefront/src/i18n/country-locale.ts (official language per
 * country, English fallback until its dictionary lands).
 *
 * Idempotent: safe to re-run (only adds missing countries, skips
 * existing tax regions). Run with:
 *   medusa exec ./src/scripts/expand-regions-row.ts
 * Run against staging first, then production.
 */

const ALL_ISOS = [
  "ad", "ae", "af", "ag", "ai", "al", "am", "ao", "aq", "ar", "as", "at",
  "au", "aw", "ax", "az", "ba", "bb", "bd", "be", "bf", "bg", "bh", "bi",
  "bj", "bl", "bm", "bn", "bo", "bq", "br", "bs", "bt", "bv", "bw", "by",
  "bz", "ca", "cc", "cd", "cf", "cg", "ch", "ci", "ck", "cl", "cm", "cn",
  "co", "cr", "cu", "cv", "cw", "cx", "cy", "cz", "de", "dj", "dk", "dm",
  "do", "dz", "ec", "ee", "eg", "eh", "er", "es", "et", "fi", "fj", "fk",
  "fm", "fo", "fr", "ga", "gb", "gd", "ge", "gf", "gg", "gh", "gi", "gl",
  "gm", "gn", "gp", "gq", "gr", "gs", "gt", "gu", "gw", "gy", "hk", "hm",
  "hn", "hr", "ht", "hu", "id", "ie", "il", "im", "in", "io", "iq", "ir",
  "is", "it", "je", "jm", "jo", "jp", "ke", "kg", "kh", "ki", "km", "kn",
  "kp", "kr", "kw", "ky", "kz", "la", "lb", "lc", "li", "lk", "lr", "ls",
  "lt", "lu", "lv", "ly", "ma", "mc", "md", "me", "mf", "mg", "mh", "mk",
  "ml", "mm", "mn", "mo", "mp", "mq", "mr", "ms", "mt", "mu", "mv", "mw",
  "mx", "my", "mz", "na", "nc", "ne", "nf", "ng", "ni", "nl", "no", "np",
  "nr", "nu", "nz", "om", "pa", "pe", "pf", "pg", "ph", "pk", "pl", "pm",
  "pn", "pr", "ps", "pt", "pw", "py", "qa", "re", "ro", "rs", "ru", "rw",
  "sa", "sb", "sc", "sd", "se", "sg", "sh", "si", "sj", "sk", "sl", "sm",
  "sn", "so", "sr", "ss", "st", "sv", "sx", "sy", "sz", "tc", "td", "tf",
  "tg", "th", "tj", "tk", "tl", "tm", "tn", "to", "tr", "tt", "tv", "tw",
  "tz", "ua", "ug", "um", "us", "uy", "uz", "va", "vc", "ve", "vg", "vi",
  "vn", "vu", "wf", "ws", "ye", "yt", "za", "zm", "zw",
];

const ROW_NAME = "Rest of World";
const ROW_CURRENCY = "eur";

type RegionRow = {
  id: string;
  name: string;
  currency_code: string;
  countries: { iso_2: string }[];
};

export default async function expandRegionsRow({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: regions }: { data: RegionRow[] } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  });

  const covered = new Set(
    (regions ?? []).flatMap((r) => r.countries.map((c) => c.iso_2))
  );
  const missing = ALL_ISOS.filter((iso) => !covered.has(iso));
  logger.info(
    `${covered.size} countries already covered, ${missing.length} to add.`
  );

  if (missing.length) {
    const row = (regions ?? []).find((r) => r.name === ROW_NAME);
    if (!row) {
      logger.info(`Creating region "${ROW_NAME}" (${ROW_CURRENCY})...`);
      const { result } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: ROW_NAME,
              currency_code: ROW_CURRENCY,
              countries: missing,
              payment_providers: ["pp_system_default"],
            },
          ],
        },
      });
      logger.info(`Created region ${result[0].id} with ${missing.length} countries.`);
    } else {
      // Medusa regions replace country lists on update — resend full set.
      const { updateRegionsWorkflow } = await import(
        "@medusajs/medusa/core-flows"
      );
      const full = [
        ...row.countries.map((c) => c.iso_2),
        ...missing,
      ];
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: row.id }, update: { countries: full } },
      });
      logger.info(`Added ${missing.length} countries to "${ROW_NAME}".`);
    }

    // Tax regions (per country; skip existing).
    const { data: taxRegions }: { data: { country_code: string }[] } =
      await query.graph({
        entity: "tax_region",
        fields: ["country_code"],
        filters: { country_code: missing },
      });
    const have = new Set((taxRegions ?? []).map((t) => t.country_code));
    const missingTax = missing.filter((c) => !have.has(c));
    if (missingTax.length) {
      await createTaxRegionsWorkflow(container).run({
        input: missingTax.map((country_code) => ({
          country_code,
          provider_id: "tp_system",
        })),
      });
      logger.info(`Created tax regions for ${missingTax.length} countries.`);
    }
  } else {
    logger.info("All ISO countries already covered — nothing to do.");
  }

  logger.info(
    "RoW expansion complete. Verify country count at /store/regions, then confirm shipping/f fulfillment covers new destinations before announcing."
  );
}
