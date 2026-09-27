import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps } from "@medusajs/framework/types";
import { Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { sdk } from "../lib/sdk";

/**
 * PR-04 — Reviews summary injected into the side column of every product
 * details page: average rating, approved count, pending count with a link to
 * the moderation queue. Read-only; moderation happens on the Reviews page.
 */
const ProductReviewsWidget = ({ data }: DetailWidgetProps<{ id: string }>) => {
  const productId = data.id;
  const { data: result } = useQuery<{
    count: number;
    average_rating: number | null;
  }>({
    queryKey: ["product-reviews", productId],
    queryFn: () =>
      sdk.client.fetch(`/store/products/${productId}/reviews`, {
        query: { take: 1 },
      }),
  });
  const { data: pending } = useQuery<{ count: number }>({
    queryKey: ["product-reviews-pending", productId],
    queryFn: () =>
      sdk.client.fetch("/admin/reviews", {
        query: { status: "pending", take: 1 },
      }),
  });

  const avg = result?.average_rating;
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h3">Reviews</Heading>
        <Text className="text-ui-fg-subtle">
          {avg != null
            ? `${avg.toFixed(1)} ★ across ${result?.count ?? 0} approved`
            : "No approved reviews yet."}
        </Text>
        {(pending?.count ?? 0) > 0 ? (
          <Text>
            <Link to="/reviews">{pending?.count} pending moderation</Link>
          </Text>
        ) : null}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.side",
});

export default ProductReviewsWidget;
