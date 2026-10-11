import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type SpendRow = {
  id: string;
  spend_date: string;
  source: string;
  campaign: string | null;
  amount_minor: number;
  currency: string;
};

const EMPTY = {
  spend_date: new Date().toISOString().slice(0, 10),
  source: "",
  campaign: "",
  amount: "",
  currency: "eur",
};

const fmt = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;

/**
 * Ads v1 — Manual spend ledger (the cost side of ROAS). Revenue lives in
 * PostHog: build an Insight on order_placed grouped by utm_source (and
 * utm_campaign), then divide by the totals below per source/campaign.
 * Amounts enter as major decimals, stored as integer minor units.
 */
const AdsPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ spend: SpendRow[] }>({
    queryKey: ["marketing-spend"],
    queryFn: () => sdk.client.fetch("/admin/marketing/spend"),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["marketing-spend"] });

  const createMutation = useMutation({
    mutationFn: (body: typeof EMPTY) =>
      sdk.client.fetch("/admin/marketing/spend", {
        method: "POST",
        body: { ...body, amount: parseFloat(body.amount) },
      }),
    onSuccess: () => {
      setNotice("Saved.");
      setForm({ ...EMPTY, spend_date: new Date().toISOString().slice(0, 10) });
      refresh();
    },
    onError: (e: Error) => setNotice(`Save failed: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/spend/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice("Deleted.");
      refresh();
    },
    onError: (e: Error) => setNotice(`Delete failed: ${e.message}`),
  });

  const set = (key: keyof typeof EMPTY) => (e: any) => {
    setNotice(null);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const totals = new Map<string, { minor: number; currency: string }>();
  for (const row of data?.spend || []) {
    const key = `${row.source} · ${row.currency.toUpperCase()}`;
    const prev = totals.get(key) || { minor: 0, currency: row.currency };
    totals.set(key, { minor: prev.minor + row.amount_minor, currency: row.currency });
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Ad spend</Heading>
        <Text className="text-ui-fg-subtle">
          Cost side of ROAS, entered by hand per source/campaign. Revenue
          comes from PostHog: Insight on order_placed grouped by utm_source,
          divided by the totals below.
        </Text>
        {notice ? (
          <Text className="mt-2 text-ui-fg-subtle">{notice}</Text>
        ) : null}
      </Container>

      <Container className="px-6 py-4">
        <Heading level="h3" className="mb-3">
          Log spend
        </Heading>
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          <div>
            <Label htmlFor="sp-date">Date</Label>
            <Input id="sp-date" type="date" value={form.spend_date} onChange={set("spend_date")} />
          </div>
          <div>
            <Label htmlFor="sp-source">Source (e.g. meta, tiktok, google)</Label>
            <Input id="sp-source" value={form.source} onChange={set("source")} placeholder="meta" />
          </div>
          <div>
            <Label htmlFor="sp-campaign">Campaign (optional)</Label>
            <Input id="sp-campaign" value={form.campaign} onChange={set("campaign")} placeholder="utm_campaign value" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sp-amount">Amount</Label>
              <Input id="sp-amount" type="number" step="0.01" min="0" value={form.amount} onChange={set("amount")} placeholder="50.00" />
            </div>
            <div>
              <Label htmlFor="sp-currency">Currency</Label>
              <Input id="sp-currency" value={form.currency} onChange={set("currency")} />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button onClick={() => createMutation.mutate(form)}>Save spend</Button>
        </div>
      </Container>

      <Container className="px-6 py-4">
        <Heading level="h3" className="mb-3">
          History
        </Heading>
        {isLoading ? (
          <Text>Loading spend…</Text>
        ) : error || !data ? (
          <Text>
            Could not load spend: {(error as Error)?.message ?? "unknown"}
          </Text>
        ) : data.spend.length === 0 ? (
          <Text className="text-ui-fg-subtle">No spend logged yet.</Text>
        ) : (
          <>
            <div className="flex gap-6 mb-3 flex-wrap">
              {[...totals.entries()].map(([key, t]) => (
                <Text key={key}>
                  <span className="font-semibold">{key}</span>: {fmt(t.minor, t.currency)}
                </Text>
              ))}
            </div>
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">
              {data.spend.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border border-ui-border-base rounded-lg px-4 py-2"
                >
                  <Text>
                    <span className="font-medium">{r.spend_date}</span>{" "}
                    {r.source}
                    {r.campaign ? ` / ${r.campaign}` : ""}{" "}
                    <span className="text-ui-fg-subtle">{fmt(r.amount_minor, r.currency)}</span>
                  </Text>
                  <Button variant="secondary" onClick={() => deleteMutation.mutate(r.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Ad Spend",
});

export default AdsPage;
