import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * PR-11 — Pricing audit. GET returns two actionable lists:
 *  - missing: variants with NO price in an active store currency (unsellable
 *    in that region — the highest-value find);
 *  - zeroDecimal: prices in zero-decimal currencies (informational until such
 *    currencies go live; JPY-style amounts must never show decimals).
 */
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "uyu", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const store = req.scope.resolve(Modules.STORE);
  const [storeRow] = await store.listStores();
  const currencies = (
    (storeRow.supported_currencies ?? []) as { currency_code: string }[]
  ).map((c) => c.currency_code);

  const { data: products }: { data: any[] } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "variants.id", "variants.title", "variants.sku", "variants.prices.*"],
    pagination: { take: 1000 },
  });

  const missing: any[] = [];
  const zeroDecimal: any[] = [];
  for (const p of products ?? []) {
    for (const v of p.variants ?? []) {
      const have = new Set(
        (v.prices ?? []).map((pr: any) => pr.currency_code)
      );
      const absent = currencies.filter((c) => !have.has(c));
      if (absent.length) {
        missing.push({
          variant_id: v.id,
          sku: v.sku,
          product: p.title,
          missing_currencies: absent,
        });
      }
      for (const pr of v.prices ?? []) {
        if (ZERO_DECIMAL.has(pr.currency_code)) {
          zeroDecimal.push({
            variant_id: v.id,
            sku: v.sku,
            currency_code: pr.currency_code,
            amount: pr.amount,
          });
        }
      }
    }
  }
  res.json({ currencies, missing, missing_count: missing.length, zeroDecimal });
};
