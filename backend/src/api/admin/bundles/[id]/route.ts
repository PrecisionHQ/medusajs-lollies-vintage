import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import type { IPromotionModuleService } from "@medusajs/framework/types";

/**
 * PR-08 — Single-bundle admin API.
 *
 * POST { name?, status? }: rename the bundle and/or toggle the underlying
 * promotion active/inactive. Component or discount changes are intentionally
 * NOT supported here — delete + recreate instead (rule surgery risk, see
 * README). DELETE removes the promotion first, then the bundle rows.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const bundles = req.scope.resolve("bundle") as any;
  const promotions: IPromotionModuleService = req.scope.resolve(
    Modules.PROMOTION
  );
  const { name, status } = (req.body ?? {}) as {
    name?: string;
    status?: "active" | "inactive";
  };

  const rows = await bundles.listBundles({ id: req.params.id });
  const bundle = rows[0];
  if (!bundle) {
    res.status(404).json({ message: "Bundle not found." });
    return;
  }
  if (name?.trim()) {
    await bundles.updateBundles({ id: bundle.id, name: name.trim() });
  }
  if (status === "active" || status === "inactive") {
    await promotions.updatePromotions({
      id: bundle.promotion_id,
      status,
    });
  }
  res.json({ ok: true });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const bundles = req.scope.resolve("bundle") as any;
  const promotions: IPromotionModuleService = req.scope.resolve(
    Modules.PROMOTION
  );

  const rows = await bundles.listBundles({ id: req.params.id });
  const bundle = rows[0];
  if (!bundle) {
    res.status(404).json({ message: "Bundle not found." });
    return;
  }
  const components = await bundles.listBundleComponents({
    bundle_id: bundle.id,
  });

  await promotions.deletePromotions([bundle.promotion_id]).catch(() => null);
  if (components.length) {
    await bundles.deleteBundleComponents(components.map((c: any) => c.id));
  }
  await bundles.deleteBundles([bundle.id]);
  res.json({ deleted: true });
};
