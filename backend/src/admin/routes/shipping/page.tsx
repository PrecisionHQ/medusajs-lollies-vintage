import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type Zone = {
  id: string;
  name: string;
  fulfillment_set: string;
  options: {
    id: string;
    name: string;
    prices: { currency_code: string; amount: number }[];
  }[];
};

/**
 * PR-12 — Shipping bands manager: one screen per service zone. Each band is
 * a native flat-rate option (name encodes the band, e.g. "Standard · up to
 * 2 kg"); eligibility is shopper-selected until carrier rates enforce weight.
 */
const ShippingPage = () => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [amounts, setAmounts] = useState("eur:1000");

  const { data } = useQuery<{ zones: Zone[] }>({
    queryKey: ["shipping-zones"],
    queryFn: () => sdk.client.fetch("/admin/shipping"),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["shipping-zones"] });

  const create = useMutation({
    mutationFn: () => {
      const parsed = amounts.split(",").map((part) => {
        const [currency_code, raw] = part.split(":").map((s) => s.trim());
        const amount = Math.round(Number(raw) * 100);
        if (!currency_code || !Number.isInteger(amount) || amount < 0) {
          throw new Error(`Bad amount=cut "${part}" (use cc:major, e.g. eur:10)`);
        }
        return { currency_code: currency_code.toLowerCase(), amount };
      });
      return sdk.client.fetch("/admin/shipping", {
        method: "POST",
        body: { service_zone_id: zoneId, name, blurb, amounts: parsed },
      });
    },
    onSuccess: () => {
      setNotice("Band created.");
      setName("");
      setBlurb("");
      refresh();
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/shipping/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice("Band deleted.");
      refresh();
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Shipping bands</Heading>
        <Text className="text-ui-fg-subtle">
          Bands are native options per zone — eligibility is shopper-selected.
          {notice ? ` · ${notice}` : null}
        </Text>
      </Container>

      <Container className="px-6 py-4 flex flex-col gap-4">
        <Heading level="h3">New band</Heading>
        <div className="flex flex-wrap gap-4">
          <div className="w-64">
            <Text className="mb-1">Service zone</Text>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="border border-ui-border-base rounded px-3 py-2 w-full"
            >
              <option value="">Select a zone…</option>
              {(data?.zones ?? []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.fulfillment_set} / {z.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-64">
            <Text className="mb-1">Name (encodes the band)</Text>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Standard · up to 2 kg"
            />
          </div>
          <div className="w-64">
            <Text className="mb-1">Amounts (cc:major, comma-separated)</Text>
            <Input
              value={amounts}
              onChange={(e) => setAmounts(e.target.value)}
              placeholder="eur:10, gbp:9"
            />
          </div>
        </div>
        <div>
          <Button
            onClick={() => create.mutate()}
            isLoading={create.isPending}
            disabled={!zoneId || !name.trim()}
          >
            Create band
          </Button>
        </div>
      </Container>

      {(data?.zones ?? []).map((z) => (
        <Container key={z.id} className="px-6 py-4">
          <Heading level="h3">
            {z.fulfillment_set} / {z.name}
          </Heading>
          {z.options.length === 0 ? (
            <Text className="text-ui-fg-subtle">No options in this zone.</Text>
          ) : (
            z.options.map((o) => (
              <div key={o.id} className="flex items-center gap-4 py-1">
                <Text className="font-semibold">{o.name}</Text>
                <Text className="text-ui-fg-subtle">
                  {o.prices
                    .map((p) => `${(p.amount / 100).toFixed(2)} ${p.currency_code.toUpperCase()}`)
                    .join(" · ")}
                </Text>
                <Button variant="secondary" onClick={() => remove.mutate(o.id)}>
                  Delete
                </Button>
              </div>
            ))
          )}
        </Container>
      ))}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Shipping",
});

export default ShippingPage;
