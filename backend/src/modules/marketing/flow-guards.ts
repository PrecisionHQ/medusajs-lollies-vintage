/**
 * Shared send-guards for the lifecycle flows (PR-02 abandoned cart inlines
 * these; PR-03+ import them from here so the rules can't drift).
 *
 * Rules, locked in SHOPIFY-PARITY.md Appendix B:
 *  - opt-out list is always respected;
 *  - max 1 marketing email per recipient per 3 days, across all flows;
 *  - every send claims an idempotency key (`flow:reference_id`) BEFORE
 *    sending so overlapping runs can't double-send.
 */

export const FREQUENCY_CAP_DAYS = 3;

export async function isOptedOut(
  marketing: any,
  email: string
): Promise<boolean> {
  const rows = await marketing.listMarketingOptOuts({ email });
  return rows.length > 0;
}

export async function recentlyEmailed(
  marketing: any,
  email: string,
  days: number = FREQUENCY_CAP_DAYS
): Promise<boolean> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const rows = await marketing.listFlowLogs({
    recipient: email,
    sent_at: { $gt: since },
  });
  return rows.length > 0;
}

export async function alreadySent(
  marketing: any,
  flow: string,
  referenceId: string
): Promise<boolean> {
  const rows = await marketing.listFlowLogs({
    idempotency_key: `${flow}:${referenceId}`,
  });
  return rows.length > 0;
}

export async function claimSend(
  marketing: any,
  flow: string,
  referenceId: string,
  recipient: string
): Promise<void> {
  await marketing.createFlowLogs({
    flow,
    reference_id: referenceId,
    idempotency_key: `${flow}:${referenceId}`,
    recipient,
    sent_at: new Date().toISOString(),
  });
}
