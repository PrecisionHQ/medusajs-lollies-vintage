import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { runPriceDrop } from "../modules/marketing/price-drop";
import { heartbeat } from "../modules/ops/heartbeat";

/**
 * P9 — Daily price-drop pass (10:00). Never throws: a failed run must
 * not wedge the scheduler; tomorrow retries whatever is left.
 */
export default async function priceDropJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const r = await runPriceDrop(container);
    logger.info(`price-drop: sent=${r.sent} skipped=${r.skipped}`);
    await heartbeat(container, "price-drop-daily", true);
  } catch (error) {
    logger.error(`price-drop job failed: ${(error as Error).message}`);
    await heartbeat(container, "price-drop-daily", false, error);
  }
}

export const config = {
  name: "price-drop-daily",
  schedule: "0 10 * * *",
};
