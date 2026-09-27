import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps } from "@medusajs/framework/types";
import { Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * PR-07 — Read-only wishlist summary on the customer detail page, for
 * support ("what were they looking at?"). Shoppers manage their own lists
 * on the storefront; admins never edit them.
 */
const CustomerWishlistWidget = ({ data }: DetailWidgetProps<{ id: string }>) => {
  const customerId = data.id;
  const { data: result } = useQuery<{
    items: { id: string; product_title: string }[];
    count: number;
  }>({
    queryKey: ["customer-wishlist", customerId],
    queryFn: () =>
      sdk.client.fetch("/admin/wishlists", { query: { customer_id: customerId } }),
  });

  const items = result?.items ?? [];
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h3">Wishlist ({result?.count ?? 0})</Heading>
        {items.length === 0 ? (
          <Text className="text-ui-fg-subtle">Nothing saved.</Text>
        ) : (
          <ul className="flex flex-col gap-y-1">
            {items.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Text>{i.product_title}</Text>
              </li>
            ))}
            {items.length > 5 ? (
              <li>
                <Text className="text-ui-fg-subtle">
                  …and {items.length - 5} more
                </Text>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "customer.details.side",
});

export default CustomerWishlistWidget;
