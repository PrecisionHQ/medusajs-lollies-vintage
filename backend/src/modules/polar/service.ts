import { Polar } from "@polar-sh/sdk"
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks"
import type { PresentmentCurrency } from "@polar-sh/sdk/models/components/presentmentcurrency.js"
import type { ProductPriceFixedCreate } from "@polar-sh/sdk/models/components/productpricefixedcreate.js"
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

export type PolarProviderOptions = {
  accessToken?: string
  server?: "sandbox" | "production"
  productId?: string
  successUrl?: string
  webhookSecret?: string
}

/**
 * Polar payments via redirect checkout sessions.
 *
 * Flow: initiatePayment creates a Polar checkout with an AD-HOC price equal
 * to the cart total (one generic Polar product, no catalog sync needed) and
 * hands the hosted checkout URL to the storefront. The shopper pays on Polar
 * and returns; authorizePayment verifies the checkout status via the API
 * (tamper-guarded against amount changes); the order.paid webhook marks the
 * session captured, which completes the cart.
 *
 * Amounts: Medusa works in major units, Polar in minor units. Converted on
 * every boundary in both directions.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
])

const toMinorUnits = (amount: unknown, currency: string): number => {
  const major = Number(amount ?? 0)
  if (!Number.isFinite(major)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Polar provider received an invalid amount: ${String(amount)}`
    )
  }
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())) {
    return Math.round(major)
  }
  return Math.round(major * 100)
}

const toMajorUnits = (minor: unknown, currency: string): number => {
  const value = Number(minor ?? 0)
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())) {
    return value
  }
  return value / 100
}

class PolarProviderService extends AbstractPaymentProvider<PolarProviderOptions> {
  static identifier = "polar"

  protected readonly options_: PolarProviderOptions
  protected polar_: Polar

  protected static hasWarnedMissingWebhookSecret = false

  static validateOptions(options: PolarProviderOptions): void {
    if (!options.accessToken) {
      throw new Error("Required option `accessToken` is missing in Polar provider")
    }
    if (!options.productId) {
      throw new Error("Required option `productId` is missing in Polar provider")
    }
    if (!options.successUrl) {
      throw new Error("Required option `successUrl` is missing in Polar provider")
    }
    if (!options.webhookSecret && !PolarProviderService.hasWarnedMissingWebhookSecret) {
      console.warn(
        "Polar webhookSecret is missing: order.paid webhooks cannot complete carts until it is set."
      )
      PolarProviderService.hasWarnedMissingWebhookSecret = true
    }
  }

  constructor(
    _: Record<string, unknown>,
    options: PolarProviderOptions
  ) {
    super(_, options)
    this.options_ = options
    this.polar_ = new Polar({
      accessToken: options.accessToken,
      server: options.server ?? "sandbox",
    })
  }

  protected client(): Polar {
    return this.polar_
  }

  async initiatePayment({
    amount,
    currency_code,
    data,
    context,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = data?.session_id as string | undefined
    const minor = toMinorUnits(amount, currency_code)
    const email =
      (context?.customer as { email?: string } | undefined)?.email ??
      (data?.email as string | undefined)

    // Ad-hoc price: arbitrary cart totals on one generic Polar product, no
    // catalog sync. Note: the TS SDK is camelCase (converted to snake_case
    // outbound by the SDK itself).
    const adHocPrice: ProductPriceFixedCreate = {
      amountType: "fixed",
      priceAmount: minor,
      priceCurrency: currency_code.toLowerCase() as PresentmentCurrency,
    }

    const checkout = await this.client().checkouts.create({
      products: [this.options_.productId as string],
      prices: {
        [this.options_.productId as string]: [adHocPrice],
      },
      metadata: {
        ...(sessionId ? { session_id: sessionId } : {}),
      },
      ...(email ? { customerEmail: email } : {}),
      successUrl: `${this.options_.successUrl}?checkout_id={CHECKOUT_ID}`,
    })

    return {
      id: checkout.id,
      data: {
        checkout_id: checkout.id,
        checkout_url: checkout.url,
        amount: minor,
        currency: currency_code.toLowerCase(),
      },
    }
  }

  async authorizePayment({
    data,
  }: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const checkoutId = data?.checkout_id as string | undefined
    if (!checkoutId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Polar checkout was never initiated for this payment session."
      )
    }

    const checkout = await this.client().checkouts.get({ id: checkoutId })

    if (checkout.status !== "succeeded") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Polar checkout ${checkout.id} is not paid (status: ${checkout.status}).`
      )
    }

    // Tamper guard: the cart total must still match what the checkout was
    // created for. A mismatch means the cart changed after initiation, so the
    // shopper must start payment again rather than pay a stale amount.
    const expected = Number(data?.amount ?? NaN)
    if (Number.isFinite(expected) && checkout.totalAmount !== expected) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cart total changed after the Polar checkout was created. Please start payment again."
      )
    }

    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data,
    }
  }

  async capturePayment(
    data: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    // Polar captures one-time payments at checkout; by the time Medusa asks
    // for capture the funds are already secured. Nothing to do.
    return { data: data.data ?? {} }
  }

  async refundPayment(
    data: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    // Refunds need the Polar order id, which only exists after payment and is
    // not mapped back onto the session. Refund from the Polar dashboard (or
    // extend this provider with an order-id lookup once live keys exist).
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Polar refunds are handled in the Polar dashboard for now: find the order by the Medusa session id in its metadata."
    )
  }

  async retrievePayment(
    data: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const checkoutId = data?.data?.checkout_id as string | undefined
    if (!checkoutId) {
      return { data: data?.data ?? {} }
    }
    const checkout = await this.client().checkouts.get({ id: checkoutId })
    return {
      data: {
        ...(data?.data ?? {}),
        status: checkout.status,
        total_amount: checkout.totalAmount,
      },
    }
  }

  async getPaymentStatus(
    data: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const checkoutId = data?.data?.checkout_id as string | undefined
    if (!checkoutId) {
      return { status: PaymentSessionStatus.PENDING, data: data?.data ?? {} }
    }
    const checkout = await this.client().checkouts.get({ id: checkoutId })
    switch (checkout.status) {
      case "succeeded":
        return {
          status: PaymentSessionStatus.AUTHORIZED,
          data: data?.data ?? {},
        }
      case "expired":
      case "failed":
        return {
          status: PaymentSessionStatus.CANCELED,
          data: data?.data ?? {},
        }
      default:
        return {
          status: PaymentSessionStatus.PENDING,
          data: data?.data ?? {},
        }
    }
  }

  async updatePayment(
    data: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    // Totals are frozen into the ad-hoc price at initiation. If the cart
    // changes, authorizePayment's amount guard forces a fresh session.
    return { data: data?.data ?? {} }
  }

  async deletePayment(
    data: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    // Nothing server-side to delete: unpaid Polar checkouts simply expire.
    return { data: data?.data ?? {} }
  }

  async cancelPayment(
    data: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    return { data: data?.data ?? {} }
  }

  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { validateEvent } = await import("@polar-sh/sdk/webhooks")

    let event: { type: string; data: Record<string, unknown> }
    try {
      const raw =
        typeof webhookData.rawData === "string"
          ? webhookData.rawData
          : (webhookData.rawData as Buffer)?.toString("utf-8") ?? ""
      const headers = Object.fromEntries(
        Object.entries(
          (webhookData.headers ?? {}) as Record<string, unknown>
        ).map(([key, value]) => [key, String(value ?? "")])
      )
      event = validateEvent(
        raw,
        headers,
        this.options_.webhookSecret ?? ""
      ) as unknown as { type: string; data: Record<string, unknown> }
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        throw error
      }
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const metadata = (event.data?.metadata ?? {}) as Record<string, unknown>
    const sessionId =
      (metadata.session_id as string | undefined) ??
      (event.data?.session_id as string | undefined)

    switch (event.type) {
      case "order.paid": {
        if (!sessionId) {
          return { action: PaymentActions.NOT_SUPPORTED }
        }
        const order = event.data as unknown as {
          totalAmount?: number
          currency?: string
        }
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: sessionId,
            amount: toMajorUnits(
              order.totalAmount ?? 0,
              order.currency ?? "usd"
            ),
          },
        }
      }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default PolarProviderService
