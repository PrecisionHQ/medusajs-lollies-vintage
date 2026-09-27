import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type BundleComponent = {
  variant_id: string;
  quantity: number;
  variant_title?: string | null;
  product_title?: string | null;
  eur_price?: number | null;
};

type BundleRow = {
  id: string;
  name: string;
  status: string;
  discount_type: string | null;
  discount_value: number | null;
  components: BundleComponent[];
  set_sum_eur: number;
  set_effective_eur: number | null;
  margin_warning: string | null;
};

/**
 * PR-08 — Bundle composer + health list.
 *
 * Create: name the set, pick component variants (product search below),
 * set quantities and one discount (percentage recommended — fixed needs a
 * currency). The margin preview uses live EUR prices; a warning shows when
 * component sales eat the bundle saving. Definition changes go through
 * delete + recreate (rule surgery isn't worth the risk); rename and
 * active/inactive toggle inline.
 */
const BundlesPage = () => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [discountValue, setDiscountValue] = useState("10");
  const [currency, setCurrency] = useState("eur");
  const [components, setComponents] = useState<BundleComponent[]>([]);
  const [search, setSearch] = useState("");

  const { data } = useQuery<{ bundles: BundleRow[] }>({
    queryKey: ["bundles"],
    queryFn: () => sdk.client.fetch("/admin/bundles"),
  });

  const { data: products } = useQuery<{ products: any[] }>({
    queryKey: ["bundle-product-search", search],
    queryFn: () =>
      sdk.client.fetch("/admin/products", { query: { q: search, limit: 10 } }),
    enabled: search.trim().length >= 2,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["bundles"] });

  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/bundles", {
        method: "POST",
        body: {
          name,
          components: components.map((c) => ({
            variant_id: c.variant_id,
            quantity: c.quantity,
          })),
          discount: {
            type: discountType,
            value: Number(discountValue),
            ...(discountType === "fixed" ? { currency_code: currency } : {}),
          },
        },
      }),
    onSuccess: () => {
      setNotice("Bundle created.");
      setName("");
      setComponents([]);
      setSearch("");
      refresh();
    },
    onError: (e: Error) => setNotice(`Create failed: ${e.message}`),
  });

  const act = useMutation({
    mutationFn: ({
      id,
      method,
      body,
    }: {
      id: string;
      method: string;
      body?: Record<string, unknown>;
    }) =>
      sdk.client.fetch(`/admin/bundles/${id}`, { method, body }),
    onSuccess: () => {
      setNotice("Saved.");
      refresh();
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  const addVariant = (variant: any, productTitle: string) => {
    if (components.some((c) => c.variant_id === variant.id)) {
      return;
    }
    const eur = variant.prices?.find((p: any) => p.currency_code === "eur");
    setComponents([
      ...components,
      {
        variant_id: variant.id,
        quantity: 1,
        variant_title: variant.title,
        product_title: productTitle,
        eur_price: eur?.amount ?? null,
      },
    ]);
  };

  const sum = components.reduce(
    (acc, c) => acc + (c.eur_price ?? 0) * c.quantity,
    0
  );
  const effective =
    discountType === "percentage" && Number(discountValue) > 0
      ? Math.round(sum * (1 - Number(discountValue) / 100))
      : null;

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Bundles</Heading>
        <Text className="text-ui-fg-subtle">
          Named sets with an automatic buy-get discount. Components decrement
          naturally; the saving shows as a promo line at checkout.
        </Text>
        {notice ? <Text>{notice}</Text> : null}
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h3">New bundle</Heading>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <Text className="mb-1">Name</Text>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Starter set"
              />
            </div>
            <div className="w-40">
              <Text className="mb-1">Discount type</Text>
              <select
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as "percentage" | "fixed")
                }
                className="border border-ui-border-base rounded px-3 py-2 w-full"
              >
                <option value="percentage">% off (recommended)</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div className="w-32">
              <Text className="mb-1">
                {discountType === "percentage" ? "Percent" : "Amount (minor units)"}
              </Text>
              <Input
                type="number"
                min={1}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
            {discountType === "fixed" ? (
              <div className="w-32">
                <Text className="mb-1">Currency</Text>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toLowerCase())}
                />
              </div>
            ) : null}
          </div>

          <div>
            <Text className="mb-1">Add components (search products, min 2 chars)</Text>
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
                    <Button
                      variant="secondary"
                      onClick={() => addVariant(v, p.title)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {components.length > 0 ? (
            <div>
              {components.map((c) => (
                <div key={c.variant_id} className="flex items-center gap-2">
                  <Text>
                    {c.product_title} — {c.variant_title} (
                    {c.eur_price != null
                      ? `€${(c.eur_price / 100).toFixed(2)}`
                      : "no EUR price"}
                    )
                  </Text>
                  <Input
                    type="number"
                    min={1}
                    value={c.quantity}
                    className="w-20"
                    onChange={(e) =>
                      setComponents(
                        components.map((x) =>
                          x.variant_id === c.variant_id
                            ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) }
                            : x
                        )
                      )
                    }
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setComponents(
                        components.filter((x) => x.variant_id !== c.variant_id)
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Text className="mt-2">
                Set sum: €{(sum / 100).toFixed(2)}
                {effective != null
                  ? ` → with ${discountValue}%: €${(effective / 100).toFixed(2)}`
                  : null}
              </Text>
            </div>
          ) : null}

          <div>
            <Button
              onClick={() => create.mutate()}
              isLoading={create.isPending}
              disabled={!name.trim() || components.length < 2}
            >
              Create bundle
            </Button>
          </div>
        </div>
      </Container>

      {(data?.bundles ?? []).map((b) => (
        <Container key={b.id} className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Heading level="h3">
                {b.name}{" "}
                <Text as="span" className="text-ui-fg-subtle">
                  ({b.status})
                </Text>
              </Heading>
              <Text>
                {b.discount_type === "percentage"
                  ? `${b.discount_value}% off`
                  : b.discount_value != null
                  ? `${(b.discount_value / 100).toFixed(2)} off`
                  : "No discount"}{" "}
                · set €{(b.set_sum_eur / 100).toFixed(2)}
                {b.set_effective_eur != null
                  ? ` → €${(b.set_effective_eur / 100).toFixed(2)}`
                  : null}
              </Text>
              <Text className="text-ui-fg-subtle">
                {b.components
                  .map(
                    (c) =>
                      `${c.product_title ?? c.variant_id} ×${c.quantity}`
                  )
                  .join(", ")}
              </Text>
              {b.margin_warning ? <Text>⚠ {b.margin_warning}</Text> : null}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                onClick={() =>
                  act.mutate({
                    id: b.id,
                    method: "POST",
                    body: {
                      status: b.status === "active" ? "inactive" : "active",
                    },
                  })
                }
              >
                {b.status === "active" ? "Pause" : "Activate"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => act.mutate({ id: b.id, method: "DELETE" })}
              >
                Delete
              </Button>
            </div>
          </div>
        </Container>
      ))}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Bundles",
});

export default BundlesPage;
