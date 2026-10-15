import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { runCrossSell } from "../modules/marketing/cross-sell";
import { heartbeat } from "../modules/ops/heartbeat";

/**
 * P9 — Daily cross-sell pass (09:00). Never throws: a failed run must
 * not wedge the scheduler; tomorrow retries whatever is left.
 */
export default async function crossSellJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const r = await runCrossSell(container);
    logger.info(`cross-sell: sent=${r.sent} skipped=${r.skipped}`);
    await heartbeat(container, "cross-sell-daily", true);
  } catch (error) {
    logger.error(`cross-sell job failed: ${(error as Error).message}`);
    await heartbeat(container, "cross-sell-daily", false, error);
  }
}

export const config = {
  name: "cross-sell-daily",
  schedule: "0 9 * * *",
};
