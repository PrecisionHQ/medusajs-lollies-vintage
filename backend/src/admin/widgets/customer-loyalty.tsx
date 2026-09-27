import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps } from "@medusajs/framework/types";
import { Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * PR-13 — Loyalty balance + recent ledger on the customer detail page.
 */
const CustomerLoyaltyWidget = ({ data }: DetailWidgetProps<{ id: string }>) => {
  const customerId = data.id;
  const { data: result } = useQuery<{
    balance: number;
    ledger: { delta: number; reason: string; created_at: string }[];
  }>({
    queryKey: ["customer-loyalty", customerId],
    queryFn: () =>
      sdk.client.fetch("/admin/loyalty/customer", {
        query: { customer_id: customerId },
      }),
  });

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h3">Loyalty ({result?.balance ?? 0} pts)</Heading>
        {(result?.ledger ?? []).slice(0, 5).map((r, i) => (
          <Text key={i} className="text-ui-fg-subtle">
            {r.delta > 0 ? "+" : ""}
            {r.delta} · {r.reason}
          </Text>
        ))}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "customer.details.side",
});

export default CustomerLoyaltyWidget;
