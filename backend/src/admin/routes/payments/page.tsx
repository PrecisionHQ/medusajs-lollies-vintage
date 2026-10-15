import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Select, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { sdk } from "../../lib/sdk";
import { PaymentsIcon } from "../../components/module-icons";

type Provider = {
  id: string;
  live: boolean;
  tx?: number;
  captured?: number;
  refunded?: number;
  currency?: string;
};

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

const money = (minor: number, currency: string) =>
  `${(Number(minor ?? 0) / 100).toFixed(2)} ${String(currency ?? "eur").toUpperCase()}`;

/**
 * Payments page: provider health, transactions, stuck queue with
 * capture/refund actions. Reads GET /admin/payments/overview (5-min poll);
 * actions POST to the core payment routes and reload the feed.
 */
const PaymentsPage = () => {
  const [provider, setProvider] = useState("all");
  const [stuckOnly, setStuckOnly] = useState(false);
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<{
    generated_at: string;
    providers: Provider[];
    transactions: Tx[];
    stuck: Tx[];
    degraded?: boolean;
  }>({
    queryKey: ["payments-overview"],
    queryFn: () => sdk.client.fetch("/admin/payments/overview"),
    refetchInterval: 300_000,
  });

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const providers = data?.providers ?? [];
  const txs = (data?.transactions ?? []).filter(
    (t) =>
      (provider === "all" || t.provider === provider) &&
      (!stuckOnly || (data?.stuck ?? []).some((s) => s.id === t.id))
  );

  const toMinor = (v: string): number | null => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      <Container className="px-5 py-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">Payments</Heading>
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "…" : "Refresh"}
          </Button>
        </div>
        {isLoading ? <Text>Loading…</Text> : null}
        {error ? <Text>Could not load: {(error as Error).message}</Text> : null}
        {data?.degraded ? (
          <Text>Sources unreachable — showing nothing rather than stale data.</Text>
        ) : null}
      </Container>

      <Container className="px-5 py-4">
        <Heading level="h3">Providers · 30 days</Heading>
        {providers.map((p) => (
          <Text key={p.id}>
            {p.live ? "● " : "○ "}
            {p.id} — {p.tx ?? 0} payments · {money(p.captured ?? 0, p.currency ?? "eur")} in
            {(p.refunded ?? 0) > 0 ? ` · ${money(p.refunded ?? 0, p.currency ?? "eur")} out` : ""}
            {!p.live && p.id !== "manual" ? " · keys missing" : ""}
          </Text>
        ))}
        {!isLoading && !providers.length && !error ? (
          <Text className="text-ui-fg-subtle">
            No providers configured — checkout is on manual payment.
          </Text>
        ) : null}
      </Container>

      <Container className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Heading level="h3">Transactions ({txs.length})</Heading>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Select value={provider} onValueChange={setProvider}>
            <Select.Trigger>
              <Select.Value placeholder="Provider" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All providers</Select.Item>
              {providers.map((p) => (
                <Select.Item key={p.id} value={p.id}>
                  {p.id}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            variant={stuckOnly ? "primary" : "secondary"}
            onClick={() => setStuckOnly((s) => !s)}
          >
            Stuck only ({data?.stuck?.length ?? 0})
          </Button>
        </div>
        {txs.slice(0, 50).map((t) => (
          <div key={t.id} className="border-t border-ui-border-base py-2 first:border-t-0">
            <Text>
              {money(t.amount, t.currency)} · {t.provider}
              {t.refunded > 0 ? ` · ${money(t.refunded, t.currency)} back` : ""}
              {t.captured <= 0 && t.authorized > 0 ? " · authorized" : ""}
            </Text>
            <Text className="text-ui-fg-subtle">
              {t.order_id ? (
                <Link to={`/orders/${t.order_id}`}>
                  #{t.order_display ?? t.id.slice(-6)}
                </Link>
              ) : (
                <>#{t.id.slice(-6)}</>
              )}
              {t.email ? ` · ${t.email}` : ""}
              {t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ""}
            </Text>
            <div className="flex items-center gap-2 mt-1">
              {t.captured <= 0 && t.authorized > 0 ? (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() =>
                    act(`capture-${t.id}`, () =>
                      sdk.client.fetch(`/admin/payments/${t.id}/capture`, {
                        method: "POST",
                        body: {},
                      })
                    )
                  }
                >
                  {busy === `capture-${t.id}` ? "…" : "Capture"}
                </Button>
              ) : null}
              <Input
                placeholder="Refund amount"
                value={refundAmounts[t.id] ?? ""}
                onChange={(e) =>
                  setRefundAmounts((m) => ({ ...m, [t.id]: e.target.value }))
                }
                className="max-w-36"
              />
              <Button
                variant="secondary"
                disabled={busy !== null || toMinor(refundAmounts[t.id] ?? "") === null}
                onClick={() => {
                  const amount = toMinor(refundAmounts[t.id] ?? "");
                  if (amount === null) return;
                  act(`refund-${t.id}`, () =>
                    sdk.client.fetch(`/admin/payments/${t.id}/refund`, {
                      method: "POST",
                      body: { amount },
                    })
                  );
                }}
              >
                {busy === `refund-${t.id}` ? "…" : "Refund"}
              </Button>
            </div>
          </div>
        ))}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Payments",
  icon: PaymentsIcon,
});

export default PaymentsPage;
