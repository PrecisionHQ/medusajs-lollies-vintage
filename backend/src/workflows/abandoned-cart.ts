import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { EmailTemplates } from "../modules/email-notifications/templates";
import { RESEND_FROM_EMAIL } from "../lib/constants";
import {
  buildRecoveryLink,
  buildUnsubscribeLink,
} from "../modules/marketing/utils";
import { mintUniqueCode } from "../modules/marketing/incentives";

/**
 * PR-02 — Abandoned-cart reminders, run hourly by src/jobs/abandoned-cart.ts.
 *
 * Reminder #1: cart with an email, items, no order, untouched for `delay_hours`.
 * Reminder #2: #1 sent, still no order, `second_delay_hours` elapsed, second_enabled,
 *   with the static incentive code when incentive_enabled.
 *
 * Guards per cart: marketing opt-out, 1-mail-per-3-days cap across all flows,
 * idempotency log (`abandoned-N:cart_id`). One bad cart never fails the run.
 */

export const ABANDONED_CART_KEY = "abandoned_cart";
const FREQUENCY_CAP_DAYS = 3;

type FlowConfigRow = {
  id: string;
  key: string;
  enabled: boolean;
  delay_hours: number;
  second_delay_hours: number;
  second_enabled: boolean;
  incentive_enabled: boolean;
  incentive_code: string | null;
};

type CandidateCart = {
  id: string;
  email: string;
  currency_code: string;
  total?: number | null;
  subtotal?: number | null;
  updated_at: string;
  items: {
    title: string;
    quantity: number;
    thumbnail?: string | null;
    unit_price?: number | null;
  }[];
};

const ensureConfigStep = createStep(
  "abandoned-cart-ensure-config",
  async (_, { container }) => {
    const marketing = container.resolve("marketing") as any;
    const existing: FlowConfigRow[] = await marketing.listFlowConfigs({
      key: ABANDONED_CART_KEY,
    });
    if (existing.length) {
      return new StepResponse(existing[0]);
    }
    const [created]: FlowConfigRow[] = await marketing.createFlowConfigs({
      key: ABANDONED_CART_KEY,
      enabled: true,
      delay_hours: 4,
      second_delay_hours: 24,
      second_enabled: true,
      incentive_enabled: false,
      incentive_code: null,
    });
    return new StepResponse(created);
  }
);

const findCandidatesStep = createStep(
  "abandoned-cart-find-candidates",
  async (config: FlowConfigRow, { container }) => {
    if (!config.enabled) {
      return new StepResponse([]);
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const cutoff = new Date(
      Date.now() - config.delay_hours * 3600 * 1000
    ).toISOString();

    const { data: carts }: { data: CandidateCart[] } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "updated_at",
        "items.title",
        "items.quantity",
        "items.thumbnail",
        "items.unit_price",
      ],
      filters: {
        completed_at: null,
        updated_at: { $lt: cutoff },
      },
      pagination: { take: 200 },
    });

    const withEmail = (carts ?? []).filter(
      (c) => c.email && (c.items?.length ?? 0) > 0
    );
    if (!withEmail.length) {
      return new StepResponse([]);
    }

    // Exclude carts that already became orders.
    const { data: orders }: { data: { cart_id: string }[] } =
      await query.graph({
        entity: "order",
        fields: ["cart_id"],
        filters: { cart_id: withEmail.map((c) => c.id) },
        pagination: { take: withEmail.length },
      });
    const ordered = new Set((orders ?? []).map((o) => o.cart_id));
    return new StepResponse(withEmail.filter((c) => !ordered.has(c.id)));
  }
);

const sendRemindersStep = createStep(
  "abandoned-cart-send-reminders",
  async (
    {
      config,
      candidates,
    }: { config: FlowConfigRow; candidates: CandidateCart[] },
    { container }
  ) => {
    const marketing = container.resolve("marketing") as any;
    const notifications = container.resolve(Modules.NOTIFICATION);
    const promotions = container.resolve(Modules.PROMOTION);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    const now = Date.now();
    const capSince = new Date(
      now - FREQUENCY_CAP_DAYS * 24 * 3600 * 1000
    ).toISOString();
    const secondCutoff = new Date(
      now - config.second_delay_hours * 3600 * 1000
    ).toISOString();

    let sentFirst = 0;
    let sentSecond = 0;
    let skipped = 0;

    for (const cart of candidates) {
      try {
        const email = cart.email.trim().toLowerCase();

        const logs: { flow: string; sent_at: string }[] =
          await marketing.listFlowLogs({
            $or: [
              { idempotency_key: `abandoned-1:${cart.id}` },
              { idempotency_key: `abandoned-2:${cart.id}` },
            ],
          });
        const first = logs.find((l) => l.flow === "abandoned-1");
        const second = logs.find((l) => l.flow === "abandoned-2");

        let flow: "abandoned-1" | "abandoned-2" | null = null;
        if (!first) {
          flow = "abandoned-1";
        } else if (
          config.second_enabled &&
          !second &&
          first.sent_at < secondCutoff
        ) {
          flow = "abandoned-2";
        }
        if (!flow) {
          skipped += 1;
          continue;
        }

        const optOuts = await marketing.listMarketingOptOuts({ email });
        if (optOuts.length) {
          skipped += 1;
          continue;
        }

        const recent = await marketing.listFlowLogs({
          recipient: email,
          sent_at: { $gt: capSince },
        });
        if (recent.length) {
          skipped += 1;
          continue;
        }

        // Claim the idempotency key before sending so concurrent runs can't double-send.
        await marketing.createFlowLogs({
          flow,
          reference_id: cart.id,
          idempotency_key: `${flow}:${cart.id}`,
          recipient: email,
          sent_at: new Date().toISOString(),
        });

        const incentiveCode =
          flow === "abandoned-2" && config.incentive_enabled
            ? await mintUniqueCode(promotions, config.incentive_code, "CART")
            : null;

        await notifications.createNotifications({
          to: email,
          channel: "email",
          template: EmailTemplates.CART_ABANDONED,
          data: {
            emailOptions: {
              replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
              subject:
                flow === "abandoned-1"
                  ? "You left something in your cart"
                  : "Still interested? Your cart is waiting",
            },
            items: cart.items.map((i) => ({
              title: i.title,
              quantity: i.quantity,
              thumbnail: i.thumbnail ?? null,
              lineTotal:
                i.unit_price != null ? i.unit_price * i.quantity : null,
            })),
            subtotal: cart.subtotal ?? null,
            currencyCode: cart.currency_code,
            recoveryLink: buildRecoveryLink(cart.id),
            unsubscribeLink: buildUnsubscribeLink(email),
            incentiveCode,
            preview: "You left something in your cart",
          },
        });

        if (flow === "abandoned-1") {
          sentFirst += 1;
        } else {
          sentSecond += 1;
        }
      } catch (error) {
        // One bad cart (bad email, missing totals) must not fail the hourly run.
        logger.warn(
          `abandoned-cart: skipping cart ${cart.id}: ${(error as Error).message}`
        );
        skipped += 1;
      }
    }

    return new StepResponse({ sentFirst, sentSecond, skipped });
  }
);

export const abandonedCartWorkflow = createWorkflow("abandoned-cart", () => {
  const config = ensureConfigStep();
  const candidates = findCandidatesStep(config);
  const summary = sendRemindersStep({ config, candidates });
  return new WorkflowResponse(summary);
});
