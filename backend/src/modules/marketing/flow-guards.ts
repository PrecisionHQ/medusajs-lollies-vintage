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

/**
 * Toggle-only flows (#5 board): price-drop, cross-sell and back-in-stock
 * send mail but historically had no on/off switch and no board presence.
 * `key` is the FlowConfig row; `flow` is the FlowLog flow value used for
 * the sent counter. Single source of truth shared by the runners (gate),
 * the admin API (board rows) and the unit test (no silent flows).
 */
export const TOGGLE_FLOWS = [
  { key: "price_drop", flow: "pricedrop" },
  { key: "cross_sell", flow: "cross-sell" },
  { key: "back_in_stock", flow: "back-in-stock" },
] as const;

/**
 * Toggle gate for the TOGGLE_FLOWS runners. No config row yet means ON
 * (preserves historical behavior until an admin flips the switch); a
 * config read failure also fails open so a sick query can never silence
 * every flow at once.
 */
export async function isFlowEnabled(
  marketing: any,
  key: string
): Promise<boolean> {
  try {
    const rows = await marketing.listFlowConfigs({ key });
    if (!rows.length) {
      return true;
    }
    return rows[0].enabled !== false;
  } catch {
    return true;
  }
}
