import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Select, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type Channel = {
  id: string;
  name?: string;
  description?: string | null;
  metadata?: { platform?: string; utm_source?: string } | null;
};

const PLATFORMS = ["instagram", "facebook", "tiktok", "google", "direct"] as const;

const feedFor = (platform?: string | null): string | null => {
  if (platform === "tiktok") return "/feeds/tiktok";
  if (platform === "google" || platform === "facebook" || platform === "instagram")
    return "/feeds/google";
  return null;
};

/**
 * Sales channels registry (Phase 3 C2): core sales_channels with channel
 * metadata (platform, utm_source for the C3 ROAS join), product counts,
 * and availability toggles. No backend wrapper — core CRUD + batch link
 * cover everything; feed URLs are convention (/feeds/<platform>).
 */
const ChannelsPage = () => {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<string>("instagram");
  const [utm, setUtm] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [found, setFound] = useState<Record<string, any[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    sales_channels: Channel[];
  }>({
    queryKey: ["sales-channels"],
    queryFn: () =>
      sdk.client.fetch("/admin/sales-channels?fields=id,name,description,metadata"),
    refetchInterval: 300_000,
  });

  const channels = data?.sales_channels ?? [];

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Request failed.");

  const create = async () => {
    if (!name.trim()) {
      setError("Name the channel first.");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      await sdk.client.fetch("/admin/sales-channels", {
        method: "POST",
        body: {
          name: name.trim(),
          metadata: {
            platform,
            ...(utm.trim() ? { utm_source: utm.trim().toLowerCase() } : {}),
          },
        },
      });
      setName("");
      setUtm("");
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(`del-${id}`);
    try {
      await sdk.client.fetch(`/admin/sales-channels/${id}`, { method: "DELETE" });
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const lookup = async (channelId: string) => {
    const q = (search[channelId] ?? "").trim();
    if (!q) return;
    setBusy(`search-${channelId}`);
    try {
      const res = (await sdk.client.fetch("/admin/products", {
        query: { q, limit: 10, fields: "id,title,sales_channels" },
      })) as any;
      setFound((f) => ({ ...f, [channelId]: res.products ?? [] }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const setMembership = async (channelId: string, productId: string, add: boolean) => {
    setBusy(`${channelId}-${productId}`);
    try {
      await sdk.client.fetch(`/admin/sales-channels/${channelId}/products`, {
        method: "POST",
        body: add ? { add: [productId] } : { remove: [productId] },
      });
      await lookup(channelId);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const inChannel = (p: any, channelId: string) =>
    (p.sales_channels ?? []).some((c: any) => c.id === channelId);

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      <Container className="px-5 py-4">
        <Heading level="h2">Sales channels</Heading>
        <Text className="text-ui-fg-subtle">
          Registry over core sales channels. Feeds: Meta/Google → /feeds/google,
          TikTok → /feeds/tiktok. The utm_source below is what C3 joins to
          order attribution for per-channel ROAS.
        </Text>
        {error ? <Text>{error}</Text> : null}
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder="Channel name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            placeholder="utm_source"
            value={utm}
            onChange={(e) => setUtm(e.target.value)}
            className="max-w-36"
          />
          <Button disabled={busy !== null} onClick={create}>
            {busy === "create" ? "…" : "Add"}
          </Button>
        </div>
      </Container>

      {isLoading ? (
        <Container className="px-5 py-4">
          <Text>Loading…</Text>
        </Container>
      ) : null}

      {channels.map((c) => {
        const meta = c.metadata ?? {};
        const feed = feedFor(meta.platform);
        const open = expanded === c.id;
        return (
          <Container key={c.id} className="px-5 py-4">
            <div className="flex items-center justify-between">
              <Heading level="h3">
                {c.name} <span className="text-ui-fg-subtle">· {meta.platform ?? "?"}</span>
              </Heading>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setExpanded(open ? null : c.id)}>
                  {open ? "Close" : "Products"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => remove(c.id)}
                >
                  {busy === `del-${c.id}` ? "…" : "Delete"}
                </Button>
              </div>
            </div>
            <Text className="text-ui-fg-subtle">
              {meta.utm_source ? `utm_source=${meta.utm_source}` : "no utm_source — unattributed"}
              {feed ? ` · feed ${feed}` : ""}
            </Text>
            {open ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search products"
                    value={search[c.id] ?? ""}
                    onChange={(e) => setSearch((s) => ({ ...s, [c.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") lookup(c.id);
                    }}
                  />
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => lookup(c.id)}
                  >
                    Go
                  </Button>
                </div>
                {(found[c.id] ?? []).map((p: any) => {
                  const member = inChannel(p, c.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between py-1">
                      <Text>{p.title}</Text>
                      <Button
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => setMembership(c.id, p.id, !member)}
                      >
                        {member ? "Remove" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Container>
        );
      })}
      <Container className="px-5 py-4">
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "…" : "Refresh"}
        </Button>
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Channels",
});

export default ChannelsPage;
