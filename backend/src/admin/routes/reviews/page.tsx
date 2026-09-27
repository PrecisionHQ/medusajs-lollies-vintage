import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type ReviewRow = {
  id: string;
  product_id: string;
  name: string;
  rating: number;
  title: string | null;
  body: string;
  status: string;
  verified: boolean;
  created_at: string;
};

/**
 * PR-04 — Review moderation queue. Pending reviews land here from the
 * storefront write form; approve makes them visible, reject hides them.
 */
const ReviewsPage = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{
    reviews: ReviewRow[];
    count: number;
  }>({
    queryKey: ["reviews", status],
    queryFn: () =>
      sdk.client.fetch("/admin/reviews", { query: { status, take: 50 } }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      sdk.client.fetch(`/admin/reviews/${id}`, {
        method: "POST",
        body: { action },
      }),
    onSuccess: () => {
      setNotice("Saved.");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Reviews</Heading>
        <Text className="text-ui-fg-subtle">
          {data ? `${data.count} ${status}` : "Moderate shopper reviews."}{" "}
          {notice ? `· ${notice}` : null}
        </Text>
        <div className="flex gap-2 mt-2">
          {["pending", "approved", "rejected"].map((s) => (
            <Button
              key={s}
              variant={status === s ? "primary" : "secondary"}
              onClick={() => setStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </Container>

      {isLoading ? (
        <Container>
          <Text>Loading…</Text>
        </Container>
      ) : null}
      {error ? (
        <Container>
          <Text>Could not load reviews: {(error as Error).message}</Text>
        </Container>
      ) : null}

      {(data?.reviews ?? []).map((r) => (
        <Container key={r.id} className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Text>
                <strong>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </strong>{" "}
                {r.title ? `— ${r.title}` : null}
              </Text>
              <Text>{r.body}</Text>
              <Text className="text-ui-fg-subtle">
                {r.name} {r.verified ? "· verified purchase" : null} ·{" "}
                {r.product_id} · {new Date(r.created_at).toLocaleDateString()}
              </Text>
            </div>
            {r.status === "pending" ? (
              <div className="flex gap-2 shrink-0">
                <Button
                  onClick={() =>
                    mutation.mutate({ id: r.id, action: "approve" })
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    mutation.mutate({ id: r.id, action: "reject" })
                  }
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </div>
        </Container>
      ))}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Reviews",
});

export default ReviewsPage;
