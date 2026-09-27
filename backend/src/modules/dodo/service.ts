import DodoPayments from "dodopayments"
import { Webhook } from "standardwebhooks"
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

export type DodoProviderOptions = {
  apiKey?: string
  webhookSecret?: string
  environment?: "test_mode" | "live_mode"
  productId?: string
  returnUrl?: string
}

/**
 * Dodo Payments via redirect checkout sessions.
 *
 * Flow: initiatePayment creates a checkout session on a single generic
 * pay-what-you-want product with the cart total set explicitly (per Dodo
 * docs, a set amount on a PWYW product charges exactly that amount), and
 * hands the hosted checkout_url to the storefront. The shopper pays on Dodo
 * and returns; authorizePayment verifies via the session/payment status
 * (tamper-guarded against amount changes); payment.succeeded webhooks mark
 * the session captured, which completes the cart.
 *
 * PENDING LIVE-KEY VERIFICATION: the per-item `amount` field on
 * product_cart entries is documented for PWYW products but has not been
 * exercised against a real key yet. If Dodo ever ignores it, the fallback
 * is dashboard product mirroring (one Dodo product per Medusa product).
 * Until verified, treat the first live test as the acceptance gate.
 *
 * Amounts: Medusa works in major units, Dodo in minor units. Converted on
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
      `Dodo provider received an invalid amount: ${String(amount)}`
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

class DodoProviderService extends AbstractPaymentProvider<DodoProviderOptions> {
  static identifier = "dodo"

  protected readonly options_: DodoProviderOptions
  protected dodo_: DodoPayments

  protected static hasWarnedMissingWebhookSecret = false

  static validateOptions(options: DodoProviderOptions): void {
    if (!options.apiKey) {
      throw new Error("Required option `apiKey` is missing in Dodo provider")
    }
    if (!options.productId) {
      throw new Error("Required option `productId` is missing in Dodo provider")
    }
    if (!options.returnUrl) {
      throw new Error("Required option `returnUrl` is missing in Dodo provider")
    }
    if (!options.webhookSecret && !DodoProviderService.hasWarnedMissingWebhookSecret) {
      console.warn(
        "Dodo webhookSecret is missing: payment.succeeded webhooks cannot complete carts until it is set."
      )
      DodoProviderService.hasWarnedMissingWebhookSecret = true
    }
  }

  constructor(
    _: Record<string, unknown>,
    options: DodoProviderOptions
  ) {
    super(_, options)
    this.options_ = options
    this.dodo_ = new DodoPayments({
      bearerToken: options.apiKey,
      environment: options.environment ?? "test_mode",
    })
  }

  protected client(): DodoPayments {
    return this.dodo_
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

    const session = await this.client().checkoutSessions.create({
      product_cart: [
        {
          product_id: this.options_.productId as string,
          quantity: 1,
          amount: minor,
        },
      ],
      ...(email
        ? { customer: { email } }
        : {}),
      billing_currency: currency_code.toUpperCase() as never,
      return_url: this.options_.returnUrl as string,
      metadata: {
        ...(sessionId ? { session_id: sessionId } : {}),
      },
    })

    return {
      id: session.session_id,
      data: {
        checkout_session_id: session.session_id,
        checkout_url: session.checkout_url ?? "",
        amount: minor,
        currency: currency_code.toLowerCase(),
      },
    }
  }

  async authorizePayment({
    data,
  }: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const sessionId = data?.checkout_session_id as string | undefined
    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Dodo checkout was never initiated for this payment session."
      )
    }

    const session = await this.client().checkoutSessions.retrieve(sessionId)

    if (session.payment_status !== "succeeded" || !session.payment_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Dodo checkout ${sessionId} is not paid (status: ${String(
          session.payment_status
        )}).`
      )
    }

    const payment = await this.client().payments.retrieve(session.payment_id)

    // Tamper guard: the charged amount must still match what the session was
    // created for. A mismatch means the cart changed after initiation.
    const expected = Number(data?.amount ?? NaN)
    const charged = Number(
      (payment as unknown as { total_amount?: unknown }).total_amount ?? NaN
    )
    if (
      Number.isFinite(expected) &&
      Number.isFinite(charged) &&
      charged !== expected
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cart total changed after the Dodo checkout was created. Please start payment again."
      )
    }

    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data: {
        ...(data ?? {}),
        dodo_payment_id: session.payment_id,
      },
    }
  }

  async capturePayment(
    data: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    // Dodo charges at checkout; by capture time the funds are secured.
    return { data: data.data ?? {} }
  }

  async refundPayment(
    data: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const paymentId =
      (data?.data?.dodo_payment_id as string | undefined) ??
      (data?.data?.payment_id as string | undefined)
    if (!paymentId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Dodo refunds need a payment id: authorize a paid session first, or refund in the Dodo dashboard."
      )
    }
    const amount = data?.amount
    await this.client().refunds.create({
      payment_id: paymentId,
      ...(amount !== undefined
        ? { amount: toMinorUnits(amount, (data?.data?.currency as string) ?? "usd") }
        : {}),
    })
    return { data: data?.data ?? {} }
  }

  async retrievePayment(
    data: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const sessionId = data?.data?.checkout_session_id as string | undefined
    if (!sessionId) {
      return { data: data?.data ?? {} }
    }
    const session = await this.client().checkoutSessions.retrieve(sessionId)
    return {
      data: {
        ...(data?.data ?? {}),
        payment_status: session.payment_status ?? undefined,
        payment_id: session.payment_id ?? undefined,
      },
    }
  }

  async getPaymentStatus(
    data: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const sessionId = data?.data?.checkout_session_id as string | undefined
    if (!sessionId) {
      return { status: PaymentSessionStatus.PENDING, data: data?.data ?? {} }
    }
    const session = await this.client().checkoutSessions.retrieve(sessionId)
    switch (session.payment_status) {
      case "succeeded":
        return {
          status: PaymentSessionStatus.AUTHORIZED,
          data: data?.data ?? {},
        }
      case "failed":
        return {
          status: PaymentSessionStatus.ERROR,
          data: data?.data ?? {},
        }
      case "cancelled":
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
    // Totals are frozen into the session at initiation. If the cart changes,
    // authorizePayment's amount guard forces a fresh session.
    return { data: data?.data ?? {} }
  }

  async deletePayment(
    data: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    // Nothing server-side to delete: unpaid Dodo sessions simply expire.
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
    let payload: { type?: string; data?: Record<string, unknown> }
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
      const verifier = new Webhook(this.options_.webhookSecret ?? "")
      payload = verifier.verify(raw, headers) as unknown as {
        type?: string
        data?: Record<string, unknown>
      }
    } catch {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const metadata = (payload.data?.metadata ?? {}) as Record<string, unknown>
    const sessionId = metadata.session_id as string | undefined

    switch (payload.type) {
      case "payment.succeeded": {
        if (!sessionId) {
          return { action: PaymentActions.NOT_SUPPORTED }
        }
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: sessionId,
            amount: toMajorUnits(
              (payload.data as { total_amount?: unknown })?.total_amount ?? 0,
              ((payload.data as { currency?: unknown })?.currency as string) ?? "usd"
            ),
          },
        }
      }
      case "payment.failed":
        return {
          action: PaymentActions.FAILED,
          ...(sessionId
            ? {
                data: {
                  session_id: sessionId,
                  amount: 0,
                },
              }
            : {}),
        }
      case "payment.processing":
        return { action: PaymentActions.PENDING }
      case "payment.cancelled":
        return { action: PaymentActions.CANCELED }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default DodoProviderService
