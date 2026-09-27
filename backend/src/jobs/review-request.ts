import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { reviewRequestWorkflow } from "../workflows/review-request";

/**
 * PR-03 — Hourly review-request pass. Idempotent via FlowLog keys;
 * never throws (a failed run retries next hour).
 */
export default async function reviewRequestJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const { result } = await reviewRequestWorkflow(container).run({});
    logger.info(
      `review-request: sent=${result.sent} skipped=${result.skipped}`
    );
  } catch (error) {
    logger.error(`review-request job failed: ${(error as Error).message}`);
  }
}

export const config = {
  name: "review-request-hourly",
  schedule: "30 * * * *",
};
