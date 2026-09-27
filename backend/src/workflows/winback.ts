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
 * PR-03 — Winback, run daily by src/jobs/winback.ts.
 *
 * Candidates: shoppers whose LATEST order is older than `delay_hours`
 * (default 720 = 30d). Reference id = that latest order id, so a shopper who
 * orders again and lapses again can be won back again. Guards: opt-out,
 * 3-day cap, idempotency. Optional static incentive code (admin-toggled).
 */

export const WINBACK_KEY = "winback";

type WinbackConfig = {
  enabled: boolean;
  delay_hours: number;
  incentive_enabled: boolean;
  incentive_code: string | null;
};

type RecentOrder = {
  id: string;
  email: string;
  created_at: string;
  customer?: { first_name?: string | null } | null;
};

const ensureConfigStep = createStep(
  "winback-ensure-config",
  async (_, { container }) => {
    const marketing = container.resolve("marketing") as any;
    const existing = await marketing.listFlowConfigs({ key: WINBACK_KEY });
    if (existing.length) {
      return new StepResponse(existing[0]);
    }
    const [created] = await marketing.createFlowConfigs({
      key: WINBACK_KEY,
      enabled: true,
      delay_hours: 720,
      second_delay_hours: 0,
      second_enabled: false,
      incentive_enabled: false,
      incentive_code: null,
    });
    return new StepResponse(created);
  }
);

const findCandidatesStep = createStep(
  "winback-find-candidates",
  async (config: WinbackConfig, { container }) => {
    if (!config.enabled) {
      return new StepResponse([]);
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const cutoff = new Date(
      Date.now() - config.delay_hours * 3600 * 1000
    ).toISOString();

    const { data: orders }: { data: RecentOrder[] } = await query.graph({
      entity: "order",
      fields: ["id", "email", "created_at", "customer.first_name"],
      pagination: { take: 500 },
    });

    // Latest order per email; lapsed if it predates the cutoff.
    // (500-row window is fine for Lollies scale; paginate if it ever isn't.)
    const latest = new Map<string, RecentOrder>();
    for (const order of orders ?? []) {
      if (!order.email) {
        continue;
      }
      const email = order.email.trim().toLowerCase();
      const current = latest.get(email);
      if (!current || order.created_at > current.created_at) {
        latest.set(email, { ...order, email });
      }
    }
    return new StepResponse(
      [...latest.values()].filter((o) => o.created_at < cutoff)
    );
  }
);

const sendWinbacksStep = createStep(
  "winback-send",
  async (
    { config, candidates }: { config: WinbackConfig; candidates: RecentOrder[] },
    { container }
  ) => {
    const marketing = container.resolve("marketing") as any;
    const notifications = container.resolve(Modules.NOTIFICATION);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const base = STOREFRONT_URL.replace(/\/$/, "");

    let sent = 0;
    let skipped = 0;

    for (const order of candidates) {
      try {
        if (
          (await alreadySent(marketing, "winback", order.id)) ||
          (await isOptedOut(marketing, order.email)) ||
          (await recentlyEmailed(marketing, order.email))
        ) {
          skipped += 1;
          continue;
        }

        await claimSend(marketing, "winback", order.id, order.email);
        await notifications.createNotifications({
          to: order.email,
          channel: "email",
          template: EmailTemplates.WINBACK,
          data: {
            emailOptions: {
              replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
              subject: "We miss you — come see what's new",
            },
            name: order.customer?.first_name ?? null,
            incentiveCode:
              config.incentive_enabled ? config.incentive_code : null,
            shopLink: base,
            unsubscribeLink: buildUnsubscribeLink(order.email),
            preview: "We miss you",
          },
        });
        sent += 1;
      } catch (error) {
        logger.warn(
          `winback: skipping ${order.email}: ${(error as Error).message}`
        );
        skipped += 1;
      }
    }

    return new StepResponse({ sent, skipped });
  }
);

export const winbackWorkflow = createWorkflow("winback", () => {
  const config = ensureConfigStep();
  const candidates = findCandidatesStep(config);
  const summary = sendWinbacksStep({ config, candidates });
  return new WorkflowResponse(summary);
});
