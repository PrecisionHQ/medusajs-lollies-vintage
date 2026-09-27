import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type PreorderRow = {
  variant_id: string;
  variant_title: string;
  product_id: string | null;
  product_title: string | null;
  available_at: string | null;
  eta_text: string | null;
};

/**
 * PR-09 — Preorder flag manager.
 *
 * Lists flagged variants; flagging needs variant + ETA text (required — a
 * preorder without a date is a support ticket). Available-at is a plain date
 * hint shown to shoppers. Clearing writes preorder:null. Money movement
 * (authorize now, capture on fulfillment) is automatic once flagged — see
 * the capture/release subscribers.
 */
const PreordersPage = () => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [variantId, setVariantId] = useState("");
  const [etaText, setEtaText] = useState("");
  const [availableAt, setAvailableAt] = useState("");

  const { data } = useQuery<{ preorders: PreorderRow[] }>({
    queryKey: ["preorders"],
    queryFn: () => sdk.client.fetch("/admin/preorders"),
  });

  const { data: products } = useQuery<{ products: any[] }>({
    queryKey: ["preorder-variant-search", search],
    queryFn: () =>
      sdk.client.fetch("/admin/products", { query: { q: search, limit: 10 } }),
    enabled: search.trim().length >= 2,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["preorders"] });

  const setFlag = useMutation({
    mutationFn: (body: {
      variant_id: string;
      preorder: { available_at: string | null; eta_text: string } | null;
    }) =>
      sdk.client.fetch("/admin/preorders", { method: "POST", body }),
    onSuccess: () => {
      setNotice("Saved.");
      setVariantId("");
      setEtaText("");
      setAvailableAt("");
      refresh();
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Preorders</Heading>
        <Text className="text-ui-fg-subtle">
          Flagged variants authorize payment at checkout and capture on
          shipment. Cancelling the order releases the authorization.
        </Text>
        {notice ? <Text>{notice}</Text> : null}
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h3">Flag a variant</Heading>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4">
          <div>
            <Text className="mb-1">Find variant (search products, min 2 chars)</Text>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
            />
            {(products?.products ?? []).map((p: any) => (
              <div key={p.id} className="mt-2">
                <Text className="font-semibold">{p.title}</Text>
                {(p.variants ?? []).map((v: any) => (
                  <div key={v.id} className="flex items-center gap-2 ml-4">
                    <Text>
                      {v.title} ({v.sku ?? v.id.slice(-6)})
                    </Text>
                    <Button variant="secondary" onClick={() => setVariantId(v.id)}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="w-80">
              <Text className="mb-1">Variant ID</Text>
              <Input
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder="variant_…"
              />
            </div>
            <div className="w-80">
              <Text className="mb-1">ETA text (required, shown to shoppers)</Text>
              <Input
                value={etaText}
                onChange={(e) => setEtaText(e.target.value)}
                placeholder="Ships late October"
              />
            </div>
            <div className="w-64">
              <Text className="mb-1">Available at (optional date hint)</Text>
              <Input
                type="date"
                value={availableAt}
                onChange={(e) => setAvailableAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!variantId.trim() || !etaText.trim()}
              onClick={() =>
                setFlag.mutate({
                  variant_id: variantId.trim(),
                  preorder: {
                    available_at: availableAt || null,
                    eta_text: etaText.trim(),
                  },
                })
              }
            >
              Flag as preorder
            </Button>
          </div>
        </div>
      </Container>

      {(data?.preorders ?? []).map((r) => (
        <Container key={r.variant_id} className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Text>
                <strong>{r.product_title ?? r.product_id}</strong> —{" "}
                {r.variant_title}
              </Text>
              <Text className="text-ui-fg-subtle">
                {r.eta_text}
                {r.available_at ? ` (from ${r.available_at})` : null}
              </Text>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                setFlag.mutate({ variant_id: r.variant_id, preorder: null })
              }
            >
              Unflag
            </Button>
          </div>
        </Container>
      ))}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Preorders",
});

export default PreordersPage;
