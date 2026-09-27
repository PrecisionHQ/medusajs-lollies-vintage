import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows";

/**
 * PR-11 — Price CSV import. POST { csv } with the export format
 * (variant_id, product_handle, sku, variant_title, price_<cc> in MAJOR units).
 * Rows match by variant_id (falling back to sku); unknown variants and bad
 * amounts are skipped and reported, never fail the batch. Upserts in chunks.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { csv } = (req.body ?? {}) as { csv?: string };
  if (typeof csv !== "string" || !csv.trim()) {
    res.status(400).json({ message: "csv is required." });
    return;
  }

  const rows = parseCsv(csv);
  const headers = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const idCol = headers.indexOf("variant_id");
  const skuCol = headers.indexOf("sku");
  if (idCol < 0 && skuCol < 0) {
    res.status(400).json({ message: "CSV needs a variant_id (or sku) column." });
    return;
  }
  const priceCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.startsWith("price_"))
    .map(({ h, i }) => ({ currency: h.slice("price_".length), i }));
  if (!priceCols.length) {
    res.status(400).json({ message: "CSV needs at least one price_<cc> column." });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: variants }: { data: any[] } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id", "sku"],
    pagination: { take: 5000 },
  });
  const byId = new Map((variants ?? []).map((v: any) => [v.id, v]));
  const bySku = new Map(
    (variants ?? []).filter((v: any) => v.sku).map((v: any) => [v.sku, v])
  );

  const updates: {
    variant_id: string;
    product_id: string;
    prices: { currency_code: string; amount: number }[];
  }[] = [];
  const skipped: string[] = [];

  rows.forEach((row, n) => {
    const ref = (row[idCol] ?? "").trim() || (row[skuCol] ?? "").trim();
    const variant =
      (idCol >= 0 && byId.get((row[idCol] ?? "").trim())) ||
      (skuCol >= 0 && bySku.get((row[skuCol] ?? "").trim()));
    if (!variant) {
      skipped.push(`row ${n + 2}: unknown variant "${ref}"`);
      return;
    }
    const prices: { currency_code: string; amount: number }[] = [];
    for (const { currency, i } of priceCols) {
      const raw = (row[i] ?? "").trim();
      if (!raw) {
        continue;
      }
      const major = Number(raw.replace(",", "."));
      if (!Number.isFinite(major) || major < 0) {
        skipped.push(`row ${n + 2}: bad amount "${raw}" for ${currency}`);
        continue;
      }
      prices.push({ currency_code: currency, amount: Math.round(major * 100) });
    }
    if (prices.length) {
      updates.push({
        variant_id: variant.id,
        product_id: variant.product_id,
        prices,
      });
    }
  });

  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await upsertVariantPricesWorkflow(req.scope).run({
      input: {
        variantPrices: updates.slice(i, i + CHUNK),
        previousVariantIds: [],
      },
    });
  }

  res.json({ updated: updates.length, skipped });
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
