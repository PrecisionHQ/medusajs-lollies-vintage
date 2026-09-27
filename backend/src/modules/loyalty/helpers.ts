/**
 * Shared loyalty helpers (PR-13): settings self-seed, balance math with
 * lazy expiry, account upsert. Imported by subscribers and store routes so
 * the rules can't drift between earn, burn and display.
 */

export const SETTINGS_KEY = "default";

export async function getSettings(loyalty: any): Promise<{
  earn_per_major: number;
  burn_threshold: number;
  burn_value_minor: number;
  burn_currency: string;
  expiry_months: number;
}> {
  const rows = await loyalty.listLoyaltySettings({ key: SETTINGS_KEY });
  if (rows.length) {
    return rows[0];
  }
  const [created] = await loyalty.createLoyaltySettings({
    key: SETTINGS_KEY,
    earn_per_major: 1,
    burn_threshold: 500,
    burn_value_minor: 500,
    burn_currency: "eur",
    expiry_months: 12,
  });
  return created;
}

export async function getAccount(loyalty: any, customerId: string) {
  const rows = await loyalty.listLoyaltyAccounts({ customer_id: customerId });
  if (rows.length) {
    return rows[0];
  }
  const [created] = await loyalty.createLoyaltyAccounts({
    customer_id: customerId,
    balance: 0,
  });
  return created;
}

/** Live balance: stored balance minus expired-but-unreconciled rows. */
export async function liveBalance(loyalty: any, customerId: string): Promise<number> {
  const account = await getAccount(loyalty, customerId);
  const now = new Date().toISOString();
  const expired = await loyalty.listLoyaltyLedgers({
    customer_id: customerId,
    delta: { $gt: 0 },
    expires_at: { $lt: now },
  });
  const expiredSum = expired.reduce((acc: number, r: any) => acc + r.delta, 0);
  return Math.max(0, account.balance - expiredSum);
}

export function expiryDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}
