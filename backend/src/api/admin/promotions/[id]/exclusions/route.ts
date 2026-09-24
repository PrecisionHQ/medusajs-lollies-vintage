import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type {
  IProductModuleService,
  IPromotionModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Exclusion-list manager for a single promotion.
 *
 * A promotion skips every line item whose product is in the exclusion list.
 * Implemented as one `ne` target rule per excluded product on the
 * promotion's application method (`items.product.id`). Target rules combine
 * with AND semantics per line item, so an item matching any excluded product
 * fails that rule and is skipped, while all other items stay eligible. All
 * other rules, budgets and usage counters on the promotion are left
 * untouched.
 *
 * (`nin` does not exist in the PromotionRule operators; `ne` does.)
 *
 * Used by the `promotion-exclusions` admin widget. Nothing here is hardcoded
 * to a specific promotion code or discount value: it operates on whichever
 * promotion id is in the URL.
 */

const TARGET_ATTRIBUTE = "items.product.id"
const EXCLUSION_OPERATOR = "ne"

type RuleValueLike = { value?: string | null }
type TargetRuleLike = {
  id: string
  attribute?: string | null
  operator?: unknown
  values?: RuleValueLike[] | null
}

async function getPromotionWithRules(
  req: AuthenticatedMedusaRequest,
  id: string
) {
  const promotionModuleService: IPromotionModuleService =
    req.scope.resolve(Modules.PROMOTION)

  return await promotionModuleService.retrievePromotion(id, {
    relations: [
      "application_method",
      "application_method.target_rules",
      "application_method.target_rules.values",
    ],
  })
}

function findExclusionRules(promotion: {
  application_method?: { target_rules?: TargetRuleLike[] | null } | null
}): TargetRuleLike[] {
  const rules = promotion?.application_method?.target_rules ?? []
  return rules.filter(
    (rule) =>
      rule.attribute === TARGET_ATTRIBUTE &&
      rule.operator === EXCLUSION_OPERATOR
  )
}

function excludedIdsOf(rules: TargetRuleLike[]): string[] {
  const ids = rules.flatMap((rule) =>
    (rule.values ?? [])
      .map((v) => v.value)
      .filter((v): v is string => Boolean(v))
  )
  return [...new Set(ids)]
}

async function resolveTitles(
  req: AuthenticatedMedusaRequest,
  ids: string[]
): Promise<{ id: string; title: string }[]> {
  if (!ids.length) {
    return []
  }

  const productModuleService: IProductModuleService = req.scope.resolve(
    Modules.PRODUCT
  )
  const products = await productModuleService.listProducts(
    { id: ids },
    { select: ["id", "title"], take: 1000 }
  )
  const titles = new Map(products.map((p) => [p.id, p.title]))

  return ids.map((id) => ({ id, title: titles.get(id) ?? id }))
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const promotion = await getPromotionWithRules(req, req.params.id)
    const ids = excludedIdsOf(findExclusionRules(promotion))

    res.json({
      promotion_id: promotion.id,
      has_application_method: Boolean(promotion.application_method),
      excluded_products: await resolveTitles(req, ids),
    })
  } catch (error) {
    console.error("promotion exclusions GET failed:", error)
    res.status(500).json({ message: "Could not read the exclusion list." })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const raw = (req.body as { product_ids?: unknown } | undefined)
      ?.product_ids
    if (
      !Array.isArray(raw) ||
      raw.some((id) => typeof id !== "string" || !id)
    ) {
      res.status(400).json({
        message: "Body must be { product_ids: string[] }.",
      })
      return
    }
    const ids = [...new Set(raw as string[])]

    const promotionModuleService: IPromotionModuleService =
      req.scope.resolve(Modules.PROMOTION)
    const promotion = await getPromotionWithRules(req, req.params.id)

    if (!promotion.application_method) {
      res.status(400).json({
        message:
          "This promotion has no application method yet. Save the promotion details first, then manage exclusions.",
      })
      return
    }

    // Replace the exclusion rules wholesale so stale entries from earlier
    // edits can never linger. Other target rules are never touched.
    const previous = findExclusionRules(promotion)
    if (previous.length) {
      await promotionModuleService.removePromotionTargetRules(
        promotion.id,
        previous.map((rule) => rule.id)
      )
    }

    if (ids.length) {
      await promotionModuleService.addPromotionTargetRules(
        promotion.id,
        ids.map((id) => ({
          attribute: TARGET_ATTRIBUTE,
          operator: EXCLUSION_OPERATOR,
          values: [id],
        }))
      )
    }

    res.json({
      promotion_id: promotion.id,
      excluded_products: await resolveTitles(req, ids),
    })
  } catch (error) {
    console.error("promotion exclusions POST failed:", error)
    res.status(500).json({ message: "Could not save the exclusion list." })
  }
}
