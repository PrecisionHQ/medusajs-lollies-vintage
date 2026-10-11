import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { runCrossSell } from "../modules/marketing/cross-sell";

/**
 * P9 — Daily cross-sell pass (09:00). Never throws: a failed run must
 * not wedge the scheduler; tomorrow retries whatever is left.
 */
export default async function crossSellJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const r = await runCrossSell(container);
    logger.info(`cross-sell: sent=${r.sent} skipped=${r.skipped}`);
  } catch (error) {
    logger.error(`cross-sell job failed: ${(error as Error).message}`);
  }
}

export const config = {
  name: "cross-sell-daily",
  schedule: "0 9 * * *",
};
