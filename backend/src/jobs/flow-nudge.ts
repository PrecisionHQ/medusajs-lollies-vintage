import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { notifyPushSubscribers } from "../modules/push/push-sender";
import { heartbeat } from "../modules/ops/heartbeat";

/**
 * Owner PWA — paused-flow nudge, daily.
 *
 * A flow turned off and forgotten silently costs sends. This job pings
 * admin-bound installs once per disable event: when a disabled config's
 * updated_at crosses the 30-day mark (inside a 24h window, so it fires
 * exactly once without storing anything). Re-enable + re-disable resets
 * updated_at and re-arms it. Never throws — a failed run must not wedge
 * the scheduler.
 */
export const NUDGE_AFTER_DAYS = 30;

export default async function flowNudgeJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const marketing = container.resolve("marketing") as any;
    const configs = await marketing.listFlowConfigs({});
    const now = Date.now();
    const lo = now - (NUDGE_AFTER_DAYS + 1) * 24 * 3600 * 1000;
    const hi = now - NUDGE_AFTER_DAYS * 24 * 3600 * 1000;
    const stale = (configs ?? []).filter((c: any) => {
      if (c.enabled !== false) return false;
      const t = new Date(c.updated_at ?? 0).getTime();
      return Number.isFinite(t) && t >= lo && t < hi;
    });
    for (const c of stale) {
      await notifyPushSubscribers(
        container,
        {
          title: `Flow paused 30 days: ${c.key}`,
          body: "It has been off a month — open the app to re-enable or leave it off deliberately.",
        },
        { adminOnly: true }
      ).catch(() => {});
      logger.info(`flow-nudge: pinged for paused flow ${c.key}`);
    }
    await heartbeat(container, "flow-nudge-daily", true);
  } catch (error) {
    logger.error(`flow-nudge job failed: ${(error as Error).message}`);
    await heartbeat(container, "flow-nudge-daily", false, error);
  }
}

export const config = {
  name: "flow-nudge-daily",
  schedule: "0 9 * * *",
};
