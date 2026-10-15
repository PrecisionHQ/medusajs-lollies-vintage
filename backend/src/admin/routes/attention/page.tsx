import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { sdk } from "../../lib/sdk";
import { AttentionIcon } from "../../components/module-icons";

type Section = {
  key: string;
  severity: "critical" | "warning" | "info";
  count: number;
  items: Record<string, unknown>[];
  degraded?: boolean;
};

/** Dashboard fix routes per section (aggregator carries PWA tabs instead). */
const FIX_ROUTES: Record<string, string | null> = {
  sla: "/orders",
  payments: "/orders",
  jobs: null,
  approvals: "/questions",
  flows_off: "/flows",
  stock: "/products",
  campaigns: "/campaigns",
  back_in_stock: "/flows",
};

const LABELS: Record<string, string> = {
  sla: "Orders waiting over 48h",
  payments: "Stuck payments",
  jobs: "Failing jobs",
  approvals: "Moderation queue",
  flows_off: "Paused flows",
  stock: "Low stock",
  campaigns: "Campaign issues",
  back_in_stock: "Unnotified restock waits",
};

const itemLine = (key: string, item: Record<string, unknown>): string => {
  const s = (v: unknown) => String(v ?? "?");
  switch (key) {
    case "sla":
      return `#${s(item.display_id)} · ${s(item.email)} · ${s(item.age_hours)}h`;
    case "payments":
      return `#${s(item.display_id)} · ${s(item.total)} ${s(item.currency)}`;
    case "jobs":
      return `${s(item.name)}: ${s(item.last_error)}`;
    case "approvals":
      return `${s(item.kind)}: ${s(item.count)}`;
    case "flows_off":
      return `${s(item.key)} · off ${s(item.days_off)}d`;
    case "stock":
      return `${s(item.title)} · ${s(item.available)} left`;
    case "campaigns":
      return `${s(item.subject)}${item.failed ? ` · ${s(item.failed)} failed` : " · stale draft"}`;
    default:
      return JSON.stringify(item);
  }
};

/**
 * Attention hub page: one severity-ordered feed of everything needing a
 * human, each row linking to its fix screen. Reads GET
 * /admin/ops/attention (5-min poll); an empty feed renders as "All clear",
 * never as a loading skeleton.
 */
const AttentionPage = () => {
  const { data, isLoading, error, refetch, isFetching } = useQuery<{
    generated_at: string;
    sections: Section[];
  }>({
    queryKey: ["ops-attention"],
    queryFn: () => sdk.client.fetch("/admin/ops/attention"),
    refetchInterval: 300_000,
  });

  const sections = data?.sections ?? [];
  const total = sections.reduce((n, s) => n + s.count, 0);

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      <Container className="px-5 py-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">
            Needs attention{total ? ` (${total})` : ""}
          </Heading>
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "…" : "Refresh"}
          </Button>
        </div>
        {isLoading ? <Text>Loading…</Text> : null}
        {error ? <Text>Could not load: {(error as Error).message}</Text> : null}
        {!isLoading && !error && !total ? (
          <Text className="text-ui-fg-subtle">
            All clear{data ? ` — checked ${new Date(data.generated_at).toLocaleTimeString()}` : ""}.
          </Text>
        ) : null}
      </Container>

      {sections.map((s) => {
        const fix = FIX_ROUTES[s.key];
        return (
          <Container key={s.key} className="px-5 py-4">
            <div className="flex items-center justify-between">
              <Heading level="h3">
                {s.severity === "critical" ? "● " : ""}
                {LABELS[s.key] ?? s.key} ({s.count})
              </Heading>
              {fix ? (
                <Link to={fix}>
                  <Button variant="secondary">Fix</Button>
                </Link>
              ) : null}
            </div>
            {s.degraded ? (
              <Text className="text-ui-fg-subtle">Source unreachable — showing nothing rather than stale data.</Text>
            ) : null}
            {s.items.map((item, i) => (
              <Text key={i}>{itemLine(s.key, item)}</Text>
            ))}
          </Container>
        );
      })}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Attention",
  icon: AttentionIcon,
});

export default AttentionPage;
