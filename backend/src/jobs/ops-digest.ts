import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { buildAttention } from "../modules/ops/attention";
import { notifyPushSubscribers } from "../modules/push/push-sender";
import { heartbeat } from "../modules/ops/heartbeat";

/**
 * Owner PWA — morning attention digest, daily 08:00.
 *
 * Reuses the hub builder directly (never HTTP-calls the server from
 * inside it). Pings admin-bound installs only when criticals or warnings
 * exist — quiet days stay silent. Body names the top section so the owner
 * can triage from the lock screen. Never throws.
 */
export default async function opsDigestJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const sections = await buildAttention(container);
    const actionable = sections.filter(
      (s) => s.count > 0 && (s.severity === "critical" || s.severity === "warning")
    );
    const total = actionable.reduce((n, s) => n + s.count, 0);
    if (total > 0) {
      const top = actionable[0];
      await notifyPushSubscribers(
        container,
        {
          title: `${total} need${total === 1 ? "s" : ""} you`,
          body: `${top.key}: ${top.count} — open the app to clear.`,
        },
        { adminOnly: true }
      ).catch(() => {});
      logger.info(`ops-digest: pinged ${total} across ${actionable.length} sections`);
    }
    await heartbeat(container, "ops-digest-daily", true);
  } catch (error) {
    logger.error(`ops-digest job failed: ${(error as Error).message}`);
    await heartbeat(container, "ops-digest-daily", false, error);
  }
}

export const config = {
  name: "ops-digest-daily",
  schedule: "0 8 * * *",
};
