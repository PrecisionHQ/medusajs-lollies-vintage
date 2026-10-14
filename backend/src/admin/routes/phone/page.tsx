import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../../lib/sdk";

type Summary = {
  today: { orders: number; revenue: { currency: string; minor: number }[] };
  week: { orders: number; revenue: { currency: string; minor: number }[] };
  questions_open: number;
  reviews_pending: number;
  flows: { key: string; enabled: boolean }[];
  low_stock: { variant_id: string; title: string; available: number }[];
};

const money = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;

const PhoneIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
);

/**
 * Phone board (#16): the shop at a glance on a small screen. One fetch
 * (GET /admin/phone/summary, 60s poll), big cards, big touch targets:
 * today/week orders + revenue, moderation queues, automation switches
 * state, and stock alerts. Read-only by design — deep work stays on the
 * full admin pages.
 */
const PhonePage = () => {
  const { data, isLoading, error, refetch, isFetching } = useQuery<Summary>({
    queryKey: ["phone-summary"],
    queryFn: () => sdk.client.fetch("/admin/phone/summary"),
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-3 max-w-xl">
      <Container className="px-5 py-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">Shop status</Heading>
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "…" : "Refresh"}
          </Button>
        </div>
        {isLoading ? <Text>Loading…</Text> : null}
        {error ? (
          <Text>Could not load: {(error as Error).message}</Text>
        ) : null}
      </Container>

      {data ? (
        <>
          <Container className="px-5 py-4">
            <Heading level="h3">Today · {data.today.orders} orders</Heading>
            {data.today.revenue.map((r) => (
              <Text key={r.currency} className="text-large">
                {money(r.minor, r.currency)}
              </Text>
            ))}
            <Text className="text-ui-fg-subtle">
              7 days: {data.week.orders} orders
              {data.week.revenue.map((r) => ` · ${money(r.minor, r.currency)}`)}
            </Text>
          </Container>

          <Container className="px-5 py-4">
            <Heading level="h3">Needs you</Heading>
            <Text>
              {data.questions_open} open questions · {data.reviews_pending}{" "}
              pending reviews
            </Text>
            <Text>
              Flows off:{" "}
              {data.flows.filter((f) => !f.enabled).length
                ? data.flows
                    .filter((f) => !f.enabled)
                    .map((f) => f.key)
                    .join(", ")
                : "none — all on"}
            </Text>
          </Container>

          <Container className="px-5 py-4">
            <Heading level="h3">
              Stock alerts ({data.low_stock.length})
            </Heading>
            {data.low_stock.length ? (
              data.low_stock.map((s) => (
                <Text key={s.variant_id}>
                  {s.title} — <strong>{s.available} left</strong>
                </Text>
              ))
            ) : (
              <Text className="text-ui-fg-subtle">Nothing under 5 units.</Text>
            )}
          </Container>
        </>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Phone",
  icon: PhoneIcon,
});

export default PhonePage;
