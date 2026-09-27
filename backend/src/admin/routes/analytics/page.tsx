import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Input, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type Summary = {
  days: number;
  order_count: number;
  currencies: {
    currency: string;
    revenue_minor: number;
    orders: number;
    aov_minor: number;
  }[];
  top_products: {
    product_id: string;
    title: string;
    qty: number;
    revenue: number;
  }[];
};

const money = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;

/**
 * PR-14 — KPI dashboard. Revenue/orders/AOV per currency (never FX-mixed)
 * and top-10 by sell-through come from Medusa data. Conversion and
 * search-no-result live in PostHog (PR-05 events) and show as connect-cards
 * until project keys are configured — no invented numbers.
 */
const AnalyticsPage = () => {
  const [days, setDays] = useState("30");
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["analytics-summary", days],
    queryFn: () =>
      sdk.client.fetch("/admin/analytics/summary", {
        query: { days },
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">Analytics</Heading>
            <Text className="text-ui-fg-subtle">
              {data
                ? `${data.order_count} orders in the last ${data.days} days`
                : "Store KPIs."}
            </Text>
          </div>
          <div className="w-32">
            <Text className="mb-1">Days</Text>
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value || "30")}
            />
          </div>
        </div>
      </Container>

      {isLoading ? (
        <Container>
          <Text>Loading…</Text>
        </Container>
      ) : null}

      {(data?.currencies ?? []).map((c) => (
        <Container key={c.currency} className="px-6 py-4">
          <Heading level="h3">{c.currency.toUpperCase()}</Heading>
          <div className="flex gap-8 mt-2">
            <div>
              <Text className="text-ui-fg-subtle">Revenue</Text>
              <Text className="text-xl-semi">
                {money(c.revenue_minor, c.currency)}
              </Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle">Orders</Text>
              <Text className="text-xl-semi">{c.orders}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle">AOV</Text>
              <Text className="text-xl-semi">
                {money(c.aov_minor, c.currency)}
              </Text>
            </div>
          </div>
        </Container>
      ))}

      <Container className="px-6 py-4">
        <Heading level="h3">Top products by sell-through</Heading>
        {(data?.top_products ?? []).map((p, i) => (
          <Text key={p.product_id ?? i}>
            {i + 1}. {p.title} — {p.qty} sold
          </Text>
        ))}
        {(data?.top_products ?? []).length === 0 ? (
          <Text className="text-ui-fg-subtle">No sales in range.</Text>
        ) : null}
      </Container>

      <Container className="px-6 py-4">
        <Heading level="h3">Conversion & search</Heading>
        <Text className="text-ui-fg-subtle">
          Sessions, conversion rate and search no-result rate live in PostHog
          (events ship since PR-05). Paste the EU project keys (KEYS.md) and
          these cards light up — the restock rule stays sell-through velocity
          + days-of-cover from the tables above.
        </Text>
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Analytics",
});

export default AnalyticsPage;
