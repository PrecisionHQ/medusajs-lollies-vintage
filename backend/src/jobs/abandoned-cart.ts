import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { abandonedCartWorkflow } from "../workflows/abandoned-cart";

/**
 * PR-02 — Hourly abandoned-cart pass. The workflow is idempotent (FlowLog keys)
 * so overlapping runs are safe. To disable, move this file out of src/jobs/
 * (never just delete the config export — that breaks the build).
 */
export default async function abandonedCartJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const { result } = await abandonedCartWorkflow(container).run({});
    logger.info(
      `abandoned-cart: sent first=${result.sentFirst} second=${result.sentSecond} skipped=${result.skipped}`
    );
  } catch (error) {
    // Never throw: a failed run must not wedge the scheduler; next hour retries.
    logger.error(
      `abandoned-cart job failed: ${(error as Error).message}`
    );
  }
}

export const config = {
  name: "abandoned-cart-hourly",
  schedule: "0 * * * *",
};
