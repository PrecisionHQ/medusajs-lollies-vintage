import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { winbackWorkflow } from "../workflows/winback";
import { heartbeat } from "../modules/ops/heartbeat";

/**
 * PR-03 — Daily winback pass. Idempotent via FlowLog keys; never throws.
 */
export default async function winbackJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const { result } = await winbackWorkflow(container).run({});
    logger.info(`winback: sent=${result.sent} skipped=${result.skipped}`);
    await heartbeat(container, "winback-daily", true);
  } catch (error) {
    logger.error(`winback job failed: ${(error as Error).message}`);
    await heartbeat(container, "winback-daily", false, error);
  }
}

export const config = {
  name: "winback-daily",
  schedule: "0 8 * * *",
};
