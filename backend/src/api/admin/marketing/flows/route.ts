import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * PR-02/03 — Admin API for the Flows page (src/admin/routes/flows).
 *
 * Flow keys mirror the workflow/subscriber constants (kept local because
 * src/admin has an isolated tsconfig that can't import from src/workflows):
 *  - abandoned_cart (hourly job, reminders #1/#2)
 *  - review_request (hourly job, post-delivery)
 *  - winback (daily job, lapsed shoppers)
 *  - welcome (customer.created subscriber, immediate)
 *
 * GET returns every flow's config (creating default rows on first read) plus
 * send counters. POST takes { key, patch } and updates one flow.
 */

const FLOW_DEFS = [
  {
    key: "abandoned_cart",
    defaults: {
      enabled: true,
      delay_hours: 4,
      second_delay_hours: 24,
      second_enabled: true,
      incentive_enabled: false,
      incentive_code: null as string | null,
    },
    countFlows: ["abandoned-1", "abandoned-2"],
  },
  {
    key: "review_request",
    defaults: {
      enabled: true,
      delay_hours: 168,
      second_delay_hours: 0,
      second_enabled: false,
      incentive_enabled: false,
      incentive_code: null as string | null,
    },
    countFlows: ["review-request"],
  },
  {
    key: "winback",
    defaults: {
      enabled: true,
      delay_hours: 720,
      second_delay_hours: 0,
      second_enabled: false,
      incentive_enabled: false,
      incentive_code: null as string | null,
    },
    countFlows: ["winback"],
  },
  {
    key: "welcome",
    defaults: {
      enabled: true,
      delay_hours: 0,
      second_delay_hours: 0,
      second_enabled: false,
      incentive_enabled: true,
      incentive_code: "WELCOME10" as string | null,
    },
    countFlows: ["welcome"],
  },
] as const;

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketing = req.scope.resolve("marketing") as any;

  const flows = [];
  for (const def of FLOW_DEFS) {
    let configs = await marketing.listFlowConfigs({ key: def.key });
    if (!configs.length) {
      configs = await marketing.createFlowConfigs({
        key: def.key,
        ...def.defaults,
      });
    }
    const config = configs[0];
    let sent = 0;
    for (const flow of def.countFlows) {
      const [, count] = await marketing.listAndCountFlowLogs({ flow });
      sent += count;
    }
    flows.push({
      key: def.key,
      config: {
        enabled: config.enabled,
        delay_hours: config.delay_hours,
        second_delay_hours: config.second_delay_hours,
        second_enabled: config.second_enabled,
        incentive_enabled: config.incentive_enabled,
        incentive_code: config.incentive_code,
      },
      sent,
    });
  }

  const [, optOuts] = await marketing.listAndCountMarketingOptOuts({});
  res.json({ flows, optOuts });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { key, ...body } = (req.body ?? {}) as {
    key?: string;
    enabled?: boolean;
    delay_hours?: number;
    second_delay_hours?: number;
    second_enabled?: boolean;
    incentive_enabled?: boolean;
    incentive_code?: string | null;
  };

  const def = FLOW_DEFS.find((d) => d.key === key);
  if (!def) {
    res.status(400).json({ message: `Unknown flow key: ${key}` });
    return;
  }

  const update: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") {
    update.enabled = body.enabled;
  }
  for (const field of ["delay_hours", "second_delay_hours"] as const) {
    if (typeof body[field] === "number" && body[field]! >= 0) {
      update[field] = Math.floor(body[field]!);
    }
  }
  if (typeof body.second_enabled === "boolean") {
    update.second_enabled = body.second_enabled;
  }
  if (typeof body.incentive_enabled === "boolean") {
    update.incentive_enabled = body.incentive_enabled;
  }
  if (
    body.incentive_code === null ||
    (typeof body.incentive_code === "string" && body.incentive_code.length <= 64)
  ) {
    update.incentive_code = body.incentive_code || null;
  }

  let configs = await marketing.listFlowConfigs({ key: def.key });
  if (!configs.length) {
    configs = await marketing.createFlowConfigs({
      key: def.key,
      ...def.defaults,
      ...update,
    });
  } else if (Object.keys(update).length) {
    await marketing.updateFlowConfigs({ id: configs[0].id, ...update });
    configs = await marketing.listFlowConfigs({ key: def.key });
  }

  res.json({ config: configs[0] });
};
