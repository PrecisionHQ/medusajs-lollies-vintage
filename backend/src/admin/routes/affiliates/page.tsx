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
  paid_minor: number;
};

type Payout = {
  id: string;
  creator_id: string;
  handle: string | null;
  amount_minor: number;
  currency: string;
  note: string | null;
  created_at: string | null;
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

  const { data: payoutsData, refetch: refetchPayouts } = useQuery<{
    payouts: Payout[];
  }>({
    queryKey: ["affiliates-payouts"],
    queryFn: () => sdk.client.fetch("/admin/affiliates/payouts"),
    refetchInterval: 300_000,
  });

  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payNote, setPayNote] = useState<Record<string, string>>({});

  const pay = async (c: Creator, currency: string, prefill: number) => {
    const raw = (payAmount[c.id] ?? "").trim();
    const major = raw ? Number(raw.replace(",", ".")) : prefill / 100;
    if (!Number.isFinite(major) || major <= 0) {
      setError("Enter a valid amount (prefilled with windowed owed).");
      return;
    }
    setBusy(`pay-${c.id}`);
    setError(null);
    try {
      await sdk.client.fetch("/admin/affiliates/payouts", {
        method: "POST",
        body: {
          creator_id: c.id,
          amount_minor: Math.round(major * 100),
          currency,
          note: payNote[c.id]?.trim() || null,
        },
      });
      setPayAmount((m) => ({ ...m, [c.id]: "" }));
      setPayNote((m) => ({ ...m, [c.id]: "" }));
      await Promise.all([refetch(), refetchPayouts()]);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

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
              {money(s.owed_minor, s.currency)} owed · {money(s.paid_minor, s.currency)} paid
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
          <PayoutBlock
            creator={c}
            stats={(stats?.rows ?? []).filter((s) => s.creator_id === c.id)}
            payouts={(payoutsData?.payouts ?? []).filter((p) => p.creator_id === c.id)}
            amount={payAmount[c.id] ?? ""}
            setAmount={(v) => setPayAmount((m) => ({ ...m, [c.id]: v }))}
            note={payNote[c.id] ?? ""}
            setNote={(v) => setPayNote((m) => ({ ...m, [c.id]: v }))}
            busy={busy === `pay-${c.id}`}
            onPay={(currency, prefill) => pay(c, currency, prefill)}
          />
        </Container>
      ))}
    </div>
  );
};

/**
 * Per-creator ledger: windowed owed + lifetime paid per currency (no
 * computed balance — different windows would make it lie), pay form
 * prefilled with windowed owed, append-only history below.
 */
const PayoutBlock = ({
  creator,
  stats,
  payouts,
  amount,
  setAmount,
  note,
  setNote,
  busy,
  onPay,
}: {
  creator: Creator;
  stats: Stat[];
  payouts: Payout[];
  amount: string;
  setAmount: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  onPay: (currency: string, prefillMinor: number) => void;
}) => {
  const currencies = [...new Set([...stats.map((s) => s.currency), ...payouts.map((p) => p.currency)])];
  if (!stats.length && !payouts.length) return null;
  return (
    <div className="mt-2 border-t border-ui-border-base pt-2">
      {currencies.map((cur) => {
        const owed = stats.filter((s) => s.currency === cur).reduce((n, s) => n + s.owed_minor, 0);
        const paid = payouts.filter((p) => p.currency === cur).reduce((n, p) => n + p.amount_minor, 0);
        return (
          <div key={cur} className="flex items-center gap-2 py-1 flex-wrap">
            <Text>
              {cur.toUpperCase()}: {money(owed, cur)} owed · {money(paid, cur)} paid
            </Text>
            <Input
              placeholder={(owed / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-28"
            />
            <Input
              placeholder="Note (PayPal id…)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="max-w-48"
            />
            <Button variant="secondary" disabled={busy} onClick={() => onPay(cur, owed)}>
              {busy ? "…" : "Record payout"}
            </Button>
          </div>
        );
      })}
      {payouts.slice(0, 5).map((p) => (
        <Text key={p.id} className="text-ui-fg-subtle">
          {money(p.amount_minor, p.currency)}
          {p.note ? ` — ${p.note}` : ""}
        </Text>
      ))}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Affiliates",
});

export default AffiliatesPage;
