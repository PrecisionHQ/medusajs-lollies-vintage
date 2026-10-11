import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { runPriceDrop } from "../modules/marketing/price-drop";

/**
 * P9 — Daily price-drop pass (10:00). Never throws: a failed run must
 * not wedge the scheduler; tomorrow retries whatever is left.
 */
export default async function priceDropJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const r = await runPriceDrop(container);
    logger.info(`price-drop: sent=${r.sent} skipped=${r.skipped}`);
  } catch (error) {
    logger.error(`price-drop job failed: ${(error as Error).message}`);
  }
}

export const config = {
  name: "price-drop-daily",
  schedule: "0 10 * * *",
};
