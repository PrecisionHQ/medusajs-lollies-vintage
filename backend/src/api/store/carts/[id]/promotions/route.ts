import { updateCartPromotionsWorkflowId } from "@medusajs/medusa/core-flows"
import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type {
  MedusaContainer,
} from "@medusajs/framework/types"
import type { HttpTypes } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  PromotionActions,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"
import { correctTopUpForCart } from "../../../../../subscribers/topup-correction"

/**
 * Store promotions route override (shadows the core route at the same path,
 * so core validation, query config, and publishable-key middlewares still
 * apply by path matcher).
 *
 * Identical to core except for one awaited step: after the native promo
 * workflow settles, the universal top-up floor correction runs INLINE before
 * the cart is refetched. The shopper therefore always receives settled
 * totals at code entry — no flash of uncorrected (stacked) numbers.
 * Native validation errors pass through untouched and byte-identical.
 */

const refetchCart = async (
  id: string,
  scope: MedusaContainer,
  fields: string[]
) => {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "cart",
    variables: { filters: { id } },
    fields,
  })

  const [cart] = await remoteQuery(queryObject)

  if (!cart) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart with id '${id}' not found`
    )
  }

  return cart
}

export const POST = async (
  req: MedusaRequest<HttpTypes.StoreCartAddPromotion, HttpTypes.SelectParams>,
  res: MedusaResponse<HttpTypes.StoreCartResponse>
) => {
  const we = req.scope.resolve(Modules.WORKFLOW_ENGINE)
  const payload = req.validatedBody

  await we.run(updateCartPromotionsWorkflowId, {
    input: {
      promo_codes: payload.promo_codes,
      cart_id: req.params.id,
      action:
        payload.promo_codes.length > 0
          ? PromotionActions.ADD
          : PromotionActions.REPLACE,
      force_refresh_payment_collection: true,
    },
  })

  await correctTopUpForCart(req.params.id, req.scope)

  const cart = await refetchCart(
    req.params.id,
    req.scope,
    req.queryConfig.fields
  )

  res.status(200).json({ cart })
}

export const DELETE = async (
  req: MedusaRequest<
    HttpTypes.StoreCartRemovePromotion,
    HttpTypes.SelectParams
  >,
  res: MedusaResponse<{
    cart: HttpTypes.StoreCart
  }>
) => {
  const we = req.scope.resolve(Modules.WORKFLOW_ENGINE)
  const payload = req.validatedBody

  await we.run(updateCartPromotionsWorkflowId, {
    input: {
      promo_codes: payload.promo_codes,
      cart_id: req.params.id,
      action: PromotionActions.REMOVE,
      force_refresh_payment_collection: true,
    },
  })

  await correctTopUpForCart(req.params.id, req.scope)

  const cart = await refetchCart(
    req.params.id,
    req.scope,
    req.queryConfig.fields
  )

  res.status(200).json({ cart })
}
