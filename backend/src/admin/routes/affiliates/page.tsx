import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Select, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type Creator = {
  id: string;
  name: string;
  handle: string;
  platform?: string | null;
  commission_pct?: number | null;
  code?: string | null;
  status?: string | null;
};

type Stat = {
  creator_id: string;
  handle: string;
  visits: number;
  redemptions: number;
  currency: string;
  revenue_minor: number;
  owed_minor: number;
};

const money = (minor: number, currency: string) =>
  `${(Number(minor ?? 0) / 100).toFixed(2)} ${String(currency ?? "eur").toUpperCase()}`;

const PLATFORMS = ["instagram", "tiktok", "youtube", "blog", "other"];

/**
 * Phase 4 (F1) — affiliate creators, invite-only model. Add creator, mint
 * a personal promo code (created via the promotions API, then stored on
 * the creator so promo rules stay in one place), pause/activate, delete.
 * Referral links are plain utm links (the storefront middleware plants the
 * cookie from query params): share `{store}/?utm_source=affiliate&
 * utm_campaign=<handle>`. Visits/redemptions/owed land in F2.
 */
const AffiliatesPage = () => {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [rate, setRate] = useState("10");
  const [pct, setPct] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    creators: Creator[];
  }>({
    queryKey: ["affiliates"],
    queryFn: () => sdk.client.fetch("/admin/affiliates"),
    refetchInterval: 300_000,
  });

  const { data: stats } = useQuery<{ rows: Stat[] }>({
    queryKey: ["affiliates-stats"],
    queryFn: () => sdk.client.fetch("/admin/affiliates/stats?days=30"),
    refetchInterval: 300_000,
  });

  const creators = data?.creators ?? [];

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Request failed.");

  const add = async () => {
    const n = Number(rate.replace(",", "."));
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("Commission must be 0-100.");
      return;
    }
    setBusy("add");
    setError(null);
    try {
      await sdk.client.fetch("/admin/affiliates", {
        method: "POST",
        body: { name: name.trim(), handle: handle.trim(), platform, commission_pct: n },
      });
      setName("");
      setHandle("");
      setRate("10");
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const mint = async (c: Creator) => {
    const v = Number((pct[c.id] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || v > 100) {
      setError("Code percent must be 1-100.");
      return;
    }
    const code = `${c.handle.toUpperCase()}${Math.round(v)}`;
    setBusy(`mint-${c.id}`);
    setError(null);
    try {
      await sdk.client.fetch("/admin/promotions", {
        method: "POST",
        body: {
          code,
          type: "standard",
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: v,
          },
        },
      });
      await sdk.client.fetch(`/admin/affiliates/${c.id}`, {
        method: "POST",
        body: { code },
      });
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (c: Creator, status: string) => {
    setBusy(`st-${c.id}`);
    try {
      await sdk.client.fetch(`/admin/affiliates/${c.id}`, {
        method: "POST",
        body: { status },
      });
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: Creator) => {
    setBusy(`del-${c.id}`);
    try {
      await sdk.client.fetch(`/admin/affiliates/${c.id}`, { method: "DELETE" });
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {(stats?.rows ?? []).length ? (
        <Container className="px-5 py-4">
          <Heading level="h3">Leaderboard · 30d</Heading>
          {(stats?.rows ?? []).slice(0, 10).map((s) => (
            <Text key={`${s.creator_id}-${s.currency}`}>
              <span className="font-medium">@{s.handle}</span> — {s.redemptions}{" "}
              redemptions · {money(s.revenue_minor, s.currency)} ·{" "}
              {money(s.owed_minor, s.currency)} owed
              <span className="text-ui-fg-subtle"> · {s.visits} visits</span>
            </Text>
          ))}
        </Container>
      ) : null}
      <Container className="px-5 py-4">
        <Heading level="h2">Affiliates</Heading>
        <Text className="text-ui-fg-subtle">
          Invite-only creators. Minted codes give shoppers % off; the rate is
          the creator's commission on attributed revenue (counted in F2).
          Referral link shape: {"{store}/?utm_source=affiliate&utm_campaign=<handle>"}.
        </Text>
        {error ? <Text>{error}</Text> : null}
        <div className="flex items-center gap-2 mt-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            className="max-w-36"
          />
          <Select value={platform} onValueChange={setPlatform}>
            <Select.Trigger>
              <Select.Value placeholder="Platform" />
            </Select.Trigger>
            <Select.Content>
              {PLATFORMS.map((p) => (
                <Select.Item key={p} value={p}>
                  {p}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            placeholder="10"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="max-w-24"
          />
          <Button disabled={busy !== null} onClick={add}>
            {busy === "add" ? "…" : "Add"}
          </Button>
        </div>
      </Container>

      {isLoading ? (
        <Container className="px-5 py-4">
          <Text>Loading…</Text>
        </Container>
      ) : null}

      {creators.map((c) => (
        <Container key={c.id} className="px-5 py-4">
          <div className="flex items-center justify-between">
            <Heading level="h3">
              {c.name} <span className="text-ui-fg-subtle">· @{c.handle}</span>
            </Heading>
            <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "…" : "Refresh"}
            </Button>
          </div>
          <Text className="text-ui-fg-subtle">
            {c.platform ?? ""} · {c.commission_pct ?? 0}% commission · {c.status ?? ""}
            {c.code ? ` · code ${c.code}` : " · no code yet"}
          </Text>
          <div className="flex items-center gap-2 mt-2">
            {!c.code ? (
              <>
                <Input
                  placeholder="% off"
                  value={pct[c.id] ?? ""}
                  onChange={(e) => setPct((m) => ({ ...m, [c.id]: e.target.value }))}
                  className="max-w-24"
                />
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => mint(c)}
                >
                  {busy === `mint-${c.id}` ? "…" : "Mint code"}
                </Button>
              </>
            ) : null}
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => setStatus(c, c.status === "active" ? "paused" : "active")}
            >
              {c.status === "active" ? "Pause" : "Activate"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => remove(c)}
            >
              Delete
            </Button>
          </div>
        </Container>
      ))}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Affiliates",
});

export default AffiliatesPage;
