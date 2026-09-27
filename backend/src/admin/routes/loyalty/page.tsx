import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

/**
 * PR-13 — Loyalty rules editor + outstanding liability. Points are real
 * liability: the outstanding total is front and center for finance.
 */
const LoyaltyPage = () => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const { data } = useQuery<{
    settings: {
      earn_per_major: number;
      burn_threshold: number;
      burn_value_minor: number;
      burn_currency: string;
      expiry_months: number;
    };
    accounts: number;
    outstanding_points: number;
  }>({
    queryKey: ["loyalty-settings"],
    queryFn: () => sdk.client.fetch("/admin/loyalty"),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const field = (name: string, fallback: number | string): string =>
    form[name] ?? String(fallback ?? "");

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const k of ["earn_per_major", "burn_threshold", "burn_value_minor", "expiry_months"]) {
        if (form[k] !== undefined && form[k] !== "") {
          body[k] = Number(form[k]);
        }
      }
      if (form.burn_currency) {
        body.burn_currency = form.burn_currency;
      }
      return sdk.client.fetch("/admin/loyalty", { method: "POST", body });
    },
    onSuccess: () => {
      setNotice("Saved.");
      setForm({});
      queryClient.invalidateQueries({ queryKey: ["loyalty-settings"] });
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Loyalty</Heading>
        <Text className="text-ui-fg-subtle">
          {data
            ? `${data.accounts} accounts · ${data.outstanding_points} points outstanding`
            : "Earn & burn, no tiers."}{" "}
          {notice ? `· ${notice}` : null}
        </Text>
      </Container>

      {data ? (
        <Container className="px-6 py-4 flex flex-col gap-4">
          <Heading level="h3">Rules</Heading>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["earn_per_major", "Points per major unit"],
                ["burn_threshold", "Points to redeem"],
                ["burn_value_minor", "Reward value (minor units)"],
                ["expiry_months", "Expiry (months)"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="w-56">
                <Text className="mb-1">{label}</Text>
                <Input
                  type="number"
                  value={field(k, data.settings[k])}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="w-40">
              <Text className="mb-1">Reward currency</Text>
              <Input
                value={field("burn_currency", data.settings.burn_currency)}
                onChange={(e) => setForm({ ...form, burn_currency: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Button onClick={() => save.mutate()} isLoading={save.isPending}>
              Save rules
            </Button>
          </div>
          <Text className="text-ui-fg-subtle">
            Earn posts on order.placed (idempotent per order), reverses on
            cancel. Partial refunds need manual adjustment — documented gap.
          </Text>
        </Container>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Loyalty",
});

export default LoyaltyPage;
