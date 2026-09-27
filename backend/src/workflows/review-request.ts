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
import { RESEND_FROM_EMAIL, STOREFRONT_URL } from "../lib/constants";
import { buildUnsubscribeLink } from "../modules/marketing/utils";
import {
  alreadySent,
  claimSend,
  isOptedOut,
  recentlyEmailed,
} from "../modules/marketing/flow-guards";

/**
 * PR-03 — Review requests, run hourly by src/jobs/review-request.ts.
 *
 * Candidates: orders with fulfillment_status "delivered" whose last update is
 * older than `delay_hours` (default 168 = 7d; updated_at is the delivered-at
 * proxy — Medusa doesn't store a separate delivered timestamp).
 * One email per order, ever. Guards: opt-out, 3-day cap, idempotency.
 * Review link points at the order in the shopper's account; per-product
 * review deep-links land with PR-04.
 */

export const REVIEW_REQUEST_KEY = "review_request";

type ReviewConfig = {
  enabled: boolean;
  delay_hours: number;
};

type DeliveredOrder = {
  id: string;
  email: string;
  display_id: string | number;
  updated_at: string;
  items?: { title: string }[];
  customer?: { first_name?: string | null } | null;
};

const ensureConfigStep = createStep(
  "review-request-ensure-config",
  async (_, { container }) => {
    const marketing = container.resolve("marketing") as any;
    const existing = await marketing.listFlowConfigs({
      key: REVIEW_REQUEST_KEY,
    });
    if (existing.length) {
      return new StepResponse(existing[0]);
    }
    const [created] = await marketing.createFlowConfigs({
      key: REVIEW_REQUEST_KEY,
      enabled: true,
      delay_hours: 168,
      second_delay_hours: 0,
      second_enabled: false,
      incentive_enabled: false,
      incentive_code: null,
    });
    return new StepResponse(created);
  }
);

const findCandidatesStep = createStep(
  "review-request-find-candidates",
  async (config: ReviewConfig, { container }) => {
    if (!config.enabled) {
      return new StepResponse([]);
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const cutoff = new Date(
      Date.now() - config.delay_hours * 3600 * 1000
    ).toISOString();

    const { data: orders }: { data: DeliveredOrder[] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "display_id",
        "updated_at",
        "items.title",
        "customer.first_name",
      ],
      filters: {
        fulfillment_status: "delivered",
        updated_at: { $lt: cutoff },
      },
      pagination: { take: 200 },
    });
    return new StepResponse((orders ?? []).filter((o) => o.email));
  }
);

const sendRequestsStep = createStep(
  "review-request-send",
  async (
    {
      config,
      candidates,
    }: { config: ReviewConfig; candidates: DeliveredOrder[] },
    { container }
  ) => {
    void config;
    const marketing = container.resolve("marketing") as any;
    const notifications = container.resolve(Modules.NOTIFICATION);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const base = STOREFRONT_URL.replace(/\/$/, "");

    let sent = 0;
    let skipped = 0;

    for (const order of candidates) {
      try {
        const email = order.email.trim().toLowerCase();
        if (
          (await alreadySent(marketing, "review-request", order.id)) ||
          (await isOptedOut(marketing, email)) ||
          (await recentlyEmailed(marketing, email))
        ) {
          skipped += 1;
          continue;
        }

        await claimSend(marketing, "review-request", order.id, email);
        await notifications.createNotifications({
          to: email,
          channel: "email",
          template: EmailTemplates.REVIEW_REQUEST,
          data: {
            emailOptions: {
              replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
              subject: "How was your order?",
            },
            name: order.customer?.first_name ?? null,
            orderDisplayId: order.display_id,
            items: (order.items ?? []).map((i) => i.title),
            reviewLink: `${base}/account/orders`,
            unsubscribeLink: buildUnsubscribeLink(email),
            preview: "How was your order?",
          },
        });
        sent += 1;
      } catch (error) {
        logger.warn(
          `review-request: skipping order ${order.id}: ${(error as Error).message}`
        );
        skipped += 1;
      }
    }

    return new StepResponse({ sent, skipped });
  }
);

export const reviewRequestWorkflow = createWorkflow("review-request", () => {
  const config = ensureConfigStep();
  const candidates = findCandidatesStep(config);
  const summary = sendRequestsStep({ config, candidates });
  return new WorkflowResponse(summary);
});
