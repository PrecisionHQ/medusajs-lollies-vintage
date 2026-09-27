import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * PR-11 — Price CSV export.
 * GET /admin/pricing/export → text/csv download, one row per variant:
 * variant_id, product_handle, sku, variant_title, price_<cc> (MAJOR units,
 * human-friendly — import multiplies back to minor units).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const store = req.scope.resolve(Modules.STORE);
  const [storeRow] = await store.listStores();
  const supported = (
    (storeRow.supported_currencies ?? []) as { currency_code: string }[]
  ).map((c) => c.currency_code);
  const currencies = supported.length ? supported : ["eur"];

  const { data: products }: { data: any[] } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.*",
    ],
    pagination: { take: 1000 },
  });

  const header = ["variant_id", "product_handle", "sku", "variant_title"];
  for (const c of currencies) {
    header.push(`price_${c}`);
  }
  const lines = [header.join(",")];
  for (const p of products ?? []) {
    for (const v of p.variants ?? []) {
      const byCurrency = new Map(
        (v.prices ?? []).map((pr: any) => [pr.currency_code, pr.amount])
      );
      const row = [
        v.id,
        csvCell(p.handle ?? ""),
        csvCell(v.sku ?? ""),
        csvCell(v.title ?? ""),
      ];
      for (const c of currencies) {
        const minor = byCurrency.get(c) as number | undefined;
        row.push(minor == null ? "" : String(minor / 100));
      }
      lines.push(row.join(","));
    }
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=prices.csv"
  );
  res.send(lines.join("\n"));
};

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
