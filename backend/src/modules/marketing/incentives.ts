import { randomBytes } from "crypto";

/**
 * P9 — Per-recipient incentive codes. The merchant keeps one template
 * promotion (the static `incentive_code` in FlowConfig); at send time we
 * clone its value into a fresh single-use code, exactly like the loyalty
 * redeem route. Anything unresolvable falls back to the static text so a
 * missing template never blocks the send.
 */
export async function mintUniqueCode(
  promotions: any,
  baseCode: string | null,
  prefix: string
): Promise<string | null> {
  if (!baseCode) return null;
  try {
    const existing = await promotions.listPromotions(
      { code: baseCode },
      { relations: ["application_method"], take: 1 }
    );
    const method = existing?.[0]?.application_method;
    const value = method?.value;
    const currency = method?.currency_code;
    if (typeof value !== "number" || !currency) {
      return baseCode;
    }
    const code = `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
    await promotions.createPromotions({
      code,
      type: "standard",
      status: "active",
      is_automatic: false,
      campaign: {
        name: `Flow incentive ${code}`,
        campaign_identifier: `flow-${code.toLowerCase()}`,
        budget: { type: "usage", limit: 1 },
      },
      application_method: {
        type: method.type ?? "fixed",
        target_type: method.target_type ?? "order",
        allocation: method.allocation ?? "across",
        value,
        currency_code: currency,
      },
    });
    return code;
  } catch {
    return baseCode;
  }
}
