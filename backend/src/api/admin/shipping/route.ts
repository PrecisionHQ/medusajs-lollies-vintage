import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows";

/**
 * PR-12 — Table-rate shipping, v1.
 *
 * Each band is a REAL shipping option in a service zone (e.g. "Standard ·
 * up to 2 kg"), with flat per-currency amounts — fully native, no custom
 * calculation engine. Band eligibility is shopper-selected; weight
 * enforcement arrives with carrier rates (documented limitation, fits
 * vintage apparel where weights cluster). Free-shipping thresholds are
 * better expressed as order promotions (subtotal gte → free shipping) and
 * stay in Admin > Promotions, not here.
 *
 * GET lists service zones with their options + prices.
 * POST creates a band: { service_zone_id, name, blurb?, amounts: [{ currency_code, amount }] }.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: sets }: { data: any[] } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name", "service_zones.id", "service_zones.name"],
  });
  const { data: options }: { data: any[] } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "service_zone_id", "prices.*"],
  });
  const byZone = new Map<string, any[]>();
  for (const o of options ?? []) {
    const list = byZone.get(o.service_zone_id) ?? [];
    list.push({
      id: o.id,
      name: o.name,
      prices: (o.prices ?? []).map((p: any) => ({
        currency_code: p.currency_code,
        amount: p.amount,
      })),
    });
    byZone.set(o.service_zone_id, list);
  }
  res.json({
    zones: (sets ?? []).flatMap((s: any) =>
      (s.service_zones ?? []).map((z: any) => ({
        id: z.id,
        name: z.name,
        fulfillment_set: s.name,
        options: byZone.get(z.id) ?? [],
      }))
    ),
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const fulfillment = req.scope.resolve(Modules.FULFILLMENT);
  const { service_zone_id, name, blurb, amounts } = (req.body ?? {}) as {
    service_zone_id?: string;
    name?: string;
    blurb?: string;
    amounts?: { currency_code: string; amount: number }[];
  };

  if (!service_zone_id || !name?.trim()) {
    res.status(400).json({ message: "service_zone_id and name are required." });
    return;
  }
  const clean = (amounts ?? []).filter(
    (a) => a.currency_code && Number.isInteger(a.amount) && a.amount >= 0
  );
  if (!clean.length) {
    res.status(400).json({
      message: "amounts needs at least one { currency_code, amount } (minor units).",
    });
    return;
  }

  const profiles = await fulfillment.listShippingProfiles({ type: "default" });
  if (!profiles.length) {
    res.status(400).json({ message: "No default shipping profile found." });
    return;
  }

  const { result } = await createShippingOptionsWorkflow(req.scope).run({
    input: [
      {
        name: name.trim(),
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id,
        shipping_profile_id: profiles[0].id,
        type: {
          label: name.trim(),
          description: blurb?.trim() || name.trim(),
          code: `band-${Date.now().toString(36)}`,
        },
        prices: clean,
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });
  res.status(201).json({ option: { id: result[0].id } });
};
