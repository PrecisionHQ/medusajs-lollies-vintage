import { randomBytes } from "crypto";
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type {
  IPromotionModuleService,
  IProductModuleService,
} from "@medusajs/framework/types";

/**
 * PR-08 — Bundle admin API.
 *
 * A bundle = an automatic buyget promotion (the discount) + Bundle rows (the
 * composition). GET lists bundles with live margin health: sum of component
 * EUR prices vs the effective set price, warning when a later sale eats the
 * margin. POST creates the promotion + rows. Definition changes go through
 * delete + recreate (rule surgery isn't worth the risk) — see [id]/route for
 * the safe rename/toggle path.
 */

const VARIANT_ID_RULE = "items.variant.id";

type ComponentInput = { variant_id: string; quantity: number };

async function enrich(
  scope: any,
  bundles: any[],
  components: any[]
): Promise<any[]> {
  const promotions: IPromotionModuleService = scope.resolve(Modules.PROMOTION);
  const byBundle = new Map<string, any[]>();
  for (const c of components) {
    const list = byBundle.get(c.bundle_id) ?? [];
    list.push(c);
    byBundle.set(c.bundle_id, list);
  }

  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const variantIds = [...new Set(components.map((c) => c.variant_id))];
  let variants: any[] = [];
  if (variantIds.length) {
    const result = await query.graph({
      entity: "product_variant",
      fields: ["id", "title", "prices.amount", "prices.currency_code", "product.title"],
      filters: { id: variantIds },
      pagination: { take: variantIds.length },
    });
    variants = result.data ?? [];
  }
  const byVariant = new Map(variants.map((v: any) => [v.id, v]));

  return await Promise.all(
    bundles.map(async (b: any) => {
      const promo = await promotions
        .retrievePromotion(b.promotion_id, {
          relations: ["application_method"],
        })
        .catch(() => null);
      const comps = (byBundle.get(b.id) ?? []).map((c: any) => {
        const v = byVariant.get(c.variant_id) as any;
        const eur = v?.prices?.find((p: any) => p.currency_code === "eur");
        return {
          variant_id: c.variant_id,
          quantity: c.quantity,
          variant_title: v?.title ?? null,
          product_title: v?.product?.title ?? null,
          eur_price: eur?.amount ?? null,
        };
      });
      const sum = comps.reduce(
        (acc: number, c: any) => acc + (c.eur_price ?? 0) * c.quantity,
        0
      );
      const method = promo?.application_method as any;
      const discountValue = method?.value ?? null;
      const discountType = method?.type ?? null;
      const effective =
        discountType === "percentage" && typeof discountValue === "number"
          ? Math.round(sum * (1 - discountValue / 100))
          : null;
      return {
        id: b.id,
        name: b.name,
        promotion_id: b.promotion_id,
        status: promo?.status ?? "missing",
        discount_type: discountType,
        discount_value: discountValue,
        components: comps,
        set_sum_eur: sum,
        set_effective_eur: effective,
        margin_warning:
          effective != null && sum > 0 && effective >= sum
            ? "Discount no longer beats buying separately — check component sales."
            : null,
      };
    })
  );
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const bundles = req.scope.resolve("bundle") as any;
  const [rows] = [await bundles.listBundles({}, { take: 100 })];
  const components = await bundles.listBundleComponents(
    rows.length ? { bundle_id: rows.map((b: any) => b.id) } : {},
    { take: 500 }
  );
  res.json({ bundles: await enrich(req.scope, rows, components) });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const bundles = req.scope.resolve("bundle") as any;
  const promotions: IPromotionModuleService = req.scope.resolve(
    Modules.PROMOTION
  );
  const products: IProductModuleService = req.scope.resolve(Modules.PRODUCT);

  const { name, components, discount } = (req.body ?? {}) as {
    name?: string;
    components?: ComponentInput[];
    discount?: { type: "percentage" | "fixed"; value: number; currency_code?: string };
  };

  if (!name?.trim()) {
    res.status(400).json({ message: "name is required." });
    return;
  }
  const clean = (components ?? []).filter(
    (c) => c.variant_id && Number.isInteger(c.quantity) && c.quantity >= 1
  );
  if (clean.length < 2) {
    res
      .status(400)
      .json({ message: "A bundle needs at least 2 component variants." });
    return;
  }
  if (
    !discount ||
    (discount.type !== "percentage" && discount.type !== "fixed") ||
    !(discount.value > 0)
  ) {
    res.status(400).json({
      message: "discount needs { type: percentage|fixed, value > 0 }.",
    });
    return;
  }
  if (discount.type === "percentage" && discount.value >= 100) {
    res.status(400).json({ message: "Percentage must be below 100." });
    return;
  }
  if (discount.type === "fixed" && !discount.currency_code) {
    res
      .status(400)
      .json({ message: "Fixed discounts need a currency_code (e.g. eur)." });
    return;
  }

  // Every component variant must exist.
  for (const c of clean) {
    const variant = await products
      .retrieveProductVariant(c.variant_id)
      .catch(() => null);
    if (!variant) {
      res.status(400).json({ message: `Variant not found: ${c.variant_id}` });
      return;
    }
  }

  const variantIds = [...new Set(clean.map((c) => c.variant_id))];
  const totalQty = clean.reduce((acc, c) => acc + c.quantity, 0);
  const code = `BUNDLE-${randomBytes(4).toString("hex").toUpperCase()}`;

  const promotion = await promotions.createPromotions({
    code,
    type: "buyget",
    status: "active",
    is_automatic: true,
    application_method: {
      type: discount.type,
      target_type: "items",
      allocation: "across",
      value: discount.value,
      ...(discount.type === "fixed"
        ? { currency_code: discount.currency_code }
        : {}),
      buy_rules_min_quantity: totalQty,
      apply_to_quantity: totalQty,
      target_rules: [
        { attribute: VARIANT_ID_RULE, operator: "in", values: variantIds },
      ],
      buy_rules: [
        { attribute: VARIANT_ID_RULE, operator: "in", values: variantIds },
      ],
    },
  });

  const [bundle] = await bundles.createBundles({
    promotion_id: promotion.id,
    name: name.trim(),
  });
  await bundles.createBundleComponents(
    clean.map((c) => ({
      bundle_id: bundle.id,
      variant_id: c.variant_id,
      quantity: c.quantity,
    }))
  );

  res.status(201).json({ bundle: { id: bundle.id, promotion_id: promotion.id } });
};
