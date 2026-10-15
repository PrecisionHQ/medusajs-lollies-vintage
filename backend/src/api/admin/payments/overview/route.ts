import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

// process.env directly (not lib/constants): constants pulls a path alias
// vitest cannot resolve, and this route is unit-tested. Booleans only —
// secrets never leave the server.
const configured: Record<string, boolean> = {
  stripe: Boolean(process.env.STRIPE_API_KEY),
  polar: Boolean(process.env.POLAR_ACCESS_TOKEN),
  dodo: Boolean(process.env.DODO_PAYMENTS_API_KEY),
};

const DAY = 24 * 3600 * 1000;

type Tx = {
  id: string;
  provider: string;
  amount: number;
  authorized: number;
  captured: number;
  refunded: number;
  currency: string;
  order_id: string | null;
  order_display: number | string | null;
  email: string | null;
  created_at: string | null;
};

/**
 * Payments overview — one fetch for the dashboard page and the PWA Money
 * tab. Transactions across Stripe/Polar/Dodo/manual with per-provider
 * 30d aggregates, provider health (key presence only — secrets never
 * leave the server), and the stuck queue (authorized, uncaptured, >24h).
 * Fail-open: any source failure returns a degraded empty payload, and
 * missing relations render as id suffixes rather than errors.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const scope = req.scope;
    const paymentModule = scope.resolve(Modules.PAYMENT) as any;
    const orderModule = scope.resolve(Modules.ORDER) as any;

    const payments = await paymentModule.listPayments(
      {},
      {
        relations: ["payment_collection"],
        take: 50,
        order: { created_at: "DESC" },
      }
    );

    const orderIds = [
      ...new Set(
        (payments ?? [])
          .map((p: any) => p.payment_collection?.order_id)
          .filter(Boolean)
      ),
    ] as string[];
    let orderById = new Map<string, any>();
    if (orderIds.length) {
      try {
        const orders = await orderModule.listOrders({ id: orderIds }, { take: orderIds.length });
        orderById = new Map((orders ?? []).map((o: any) => [o.id, o]));
      } catch {
        orderById = new Map();
      }
    }

    const txs: Tx[] = (payments ?? []).map((p: any) => {
      const oid = p.payment_collection?.order_id ?? null;
      const order = oid ? orderById.get(oid) : null;
      return {
        id: String(p.id),
        provider: String(p.provider_id ?? "manual"),
        amount: Number(p.amount ?? 0),
        authorized: Number(p.authorized_amount ?? 0),
        captured: Number(p.captured_amount ?? (p.captured_at ? p.amount ?? 0 : 0)),
        refunded: Number(p.refunded_amount ?? 0),
        currency: String(p.currency_code ?? "eur").toLowerCase(),
        order_id: oid ? String(oid) : null,
        order_display: order?.display_id ?? (oid ? oid.slice(-6) : null),
        email: order?.email ?? null,
        created_at: p.created_at ?? null,
      };
    });

    const monthAgo = new Date(Date.now() - 30 * DAY);
    const recent = (txs as (Tx & { created_at: string | null })[]).filter(
      (t) => t.created_at && new Date(t.created_at).getTime() > monthAgo.getTime()
    );
    const byProvider = new Map<string, { tx: number; captured: number; refunded: number; currency: string }>();
    for (const t of recent) {
      const row = byProvider.get(t.provider) ?? { tx: 0, captured: 0, refunded: 0, currency: t.currency };
      row.tx += 1;
      row.captured += t.captured;
      row.refunded += t.refunded;
      byProvider.set(t.provider, row);
    }

    const seenProviders = new Set([...byProvider.keys(), ...Object.keys(configured).filter((k) => configured[k])]);
    if (txs.some((t) => t.provider === "manual")) {
      seenProviders.add("manual");
    }
    const providers = [...seenProviders].map((id) => ({
      id,
      live: id === "manual" ? true : (configured[id] ?? false),
      ...(byProvider.get(id) ?? { tx: 0, captured: 0, refunded: 0, currency: "eur" }),
    }));

    const cutoff = Date.now() - DAY;
    const stuck = txs
      .filter(
        (t) =>
          t.captured <= 0 &&
          t.authorized > 0 &&
          t.created_at &&
          new Date(t.created_at).getTime() < cutoff
      )
      .slice(0, 10);

    res.json({ generated_at: new Date().toISOString(), providers, transactions: txs, stuck });
  } catch {
    res.json({ generated_at: new Date().toISOString(), providers: [], transactions: [], stuck: [], degraded: true });
  }
};
