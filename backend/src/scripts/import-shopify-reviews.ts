import { readFileSync } from "fs";
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * PR-04 — One-off Shopify review import.
 *
 * Usage:
 *   REVIEWS_CSV=/path/to/reviews.csv npx medusa exec ./src/scripts/import-shopify-reviews.ts
 *
 * Accepts Judge.me / Loox / plain exports: headers are matched case-insensitively
 * against known aliases, so column order doesn't matter. Required: something
 * identifying the product (handle preferred) + a rating + a body.
 *
 * Imported rows are `approved` with `verified=false` and `customer_id=null`
 * (no Medusa account to link — see Appendix B decision). Exact-duplicate
 * bodies per product are skipped, so re-running is safe.
 */

const HEADER_ALIASES: Record<string, string[]> = {
  handle: ["product_handle", "handle", "product handle", "product"],
  rating: ["rating", "score", "stars", "rate"],
  title: ["review_title", "title", "headline"],
  body: ["review_body", "body", "review", "content", "comment"],
  name: ["reviewer_name", "author", "name", "reviewer", "customer_name"],
  email: ["reviewer_email", "email", "customer_email"],
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

export default async function importShopifyReviews({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const reviews = container.resolve("review") as any;
  const products = container.resolve(Modules.PRODUCT);

  const path = process.env.REVIEWS_CSV ?? process.argv[2];
  if (!path) {
    throw new Error("Set REVIEWS_CSV or pass the CSV path as an argument.");
  }
  const rows = parseCsv(readFileSync(path, "utf8"));
  const headers = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const col = (key: string): number =>
    headers.findIndex((h) => HEADER_ALIASES[key].includes(h));

  const iHandle = col("handle");
  const iRating = col("rating");
  const iBody = col("body");
  if (iHandle < 0 || iRating < 0 || iBody < 0) {
    throw new Error(
      `CSV must have product, rating and body columns. Found: ${headers.join(", ")}`
    );
  }
  const iTitle = col("title");
  const iName = col("name");
  const iEmail = col("email");

  let created = 0;
  let skipped = 0;
  for (const [n, row] of rows.entries()) {
    try {
      const handle = row[iHandle]?.trim();
      const rating = Math.round(Number(row[iRating]));
      const body = row[iBody]?.trim();
      if (!handle || !(rating >= 1 && rating <= 5) || !body) {
        skipped += 1;
        continue;
      }
      const [product] = await products.listProducts({ handle });
      if (!product) {
        logger.warn(`Row ${n + 2}: no product with handle "${handle}" — skipped.`);
        skipped += 1;
        continue;
      }
      const existing = await reviews.listReviews({
        product_id: product.id,
        body,
      });
      if (existing.length) {
        skipped += 1;
        continue;
      }
      const email = iEmail >= 0 ? row[iEmail]?.trim() : "";
      const name =
        (iName >= 0 ? row[iName]?.trim() : "") ||
        (email ? email.split("@")[0] : "Imported shopper");
      await reviews.createReviews({
        product_id: product.id,
        customer_id: null,
        name,
        rating,
        title: iTitle >= 0 ? row[iTitle]?.trim() || null : null,
        body,
        status: "approved",
        verified: false,
      });
      created += 1;
    } catch (error) {
      logger.warn(`Row ${n + 2}: ${(error as Error).message} — skipped.`);
      skipped += 1;
    }
  }
  logger.info(`Review import done: ${created} created, ${skipped} skipped.`);
}
