import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Button,
  Container,
  Heading,
  Input,
  Switch,
  Text,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type FlowConfig = {
  enabled: boolean;
  delay_hours: number;
  second_delay_hours: number;
  second_enabled: boolean;
  incentive_enabled: boolean;
  incentive_code: string | null;
};

type FlowRow = { key: string; config: FlowConfig; sent: number };
type FlowsResponse = { flows: FlowRow[]; optOuts: number };

const FLOW_META: Record<
  string,
  { title: string; blurb: string; delayLabel: string; showSecond: boolean }
> = {
  abandoned_cart: {
    title: "Abandoned cart",
    blurb:
      "Reminder #1 goes out after the delay; reminder #2 follows once, only if enabled. Runs hourly.",
    delayLabel: "Reminder #1 delay (hours)",
    showSecond: true,
  },
  review_request: {
    title: "Review request",
    blurb:
      "One email per delivered order, once the order is older than the delay. Runs hourly.",
    delayLabel: "Delay after delivery (hours)",
    showSecond: false,
  },
  winback: {
    title: "Winback",
    blurb:
      "One email per lapse to shoppers whose latest order is older than the delay. Runs daily at 08:00.",
    delayLabel: "Lapse delay (hours)",
    showSecond: false,
  },
  welcome: {
    title: "Welcome",
    blurb:
      "Sent immediately on account signup. The code is static text — create the matching promotion in Promotions.",
    delayLabel: "Delay (hours)",
    showSecond: false,
  },
};

/**
 * PR-02/03 — Marketing flows control panel.
 *
 * One card per flow: on/off, delays, second-reminder / incentive controls
 * where they apply, plus send counters. Saving PATCHes one flow at a time
 * to /admin/marketing/flows.
 */
const FlowsPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<FlowsResponse>({
    queryKey: ["marketing-flows"],
    queryFn: () => sdk.client.fetch("/admin/marketing/flows"),
  });

  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ key, patch }: { key: string; patch: Partial<FlowConfig> }) =>
      sdk.client.fetch("/admin/marketing/flows", {
        method: "POST",
        body: { key, ...patch },
      }),
    onSuccess: () => {
      setNotice("Saved.");
      queryClient.invalidateQueries({ queryKey: ["marketing-flows"] });
    },
    onError: (e: Error) => setNotice(`Save failed: ${e.message}`),
  });

  if (isLoading) {
    return (
      <Container>
        <Text>Loading flows…</Text>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container>
        <Text>
          Could not load flows: {(error as Error)?.message ?? "unknown error"}
        </Text>
      </Container>
    );
  }

  const set = (key: string, patch: Partial<FlowConfig>) => {
    setNotice(null);
    mutation.mutate({ key, patch });
  };

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Marketing Automation</Heading>
        <Text className="text-ui-fg-subtle">
          {data.optOuts} shoppers unsubscribed. Every flow respects opt-outs
          and the 1-mail-per-3-days cap.
        </Text>
        {notice ? <Text>{notice}</Text> : null}
      </Container>

      {data.flows.map(({ key, config, sent }) => {
        const meta = FLOW_META[key] ?? {
          title: key,
          blurb: "",
          delayLabel: "Delay (hours)",
          showSecond: false,
        };
        return (
          <Container key={key} className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <Heading level="h3">{meta.title}</Heading>
                <Text className="text-ui-fg-subtle">{meta.blurb}</Text>
              </div>
              <div className="flex items-center gap-2">
                <Text>Enabled</Text>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => set(key, { enabled: v })}
                />
              </div>
            </div>

            <div className="px-6 py-4 flex flex-wrap items-end gap-4">
              <div className="w-64">
                <Text className="mb-1">{meta.delayLabel}</Text>
                <Input
                  type="number"
                  min={key === "welcome" ? 0 : 1}
                  defaultValue={config.delay_hours}
                  key={`${key}-d1-${config.delay_hours}`}
                  onBlur={(e) =>
                    set(key, {
                      delay_hours: Math.max(
                        0,
                        Math.floor(Number(e.target.value) || 0)
                      ),
                    })
                  }
                />
              </div>

              {meta.showSecond ? (
                <>
                  <div className="w-64">
                    <Text className="mb-1">Reminder #2 delay after #1 (hours)</Text>
                    <Input
                      type="number"
                      min={1}
                      defaultValue={config.second_delay_hours}
                      key={`${key}-d2-${config.second_delay_hours}`}
                      onBlur={(e) =>
                        set(key, {
                          second_delay_hours: Math.max(
                            1,
                            Math.floor(Number(e.target.value) || 24)
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Text>Reminder #2</Text>
                    <Switch
                      checked={config.second_enabled}
                      onCheckedChange={(v) => set(key, { second_enabled: v })}
                    />
                  </div>
                </>
              ) : null}

              <div className="flex items-center gap-2 pb-2">
                <Text>Incentive code</Text>
                <Switch
                  checked={config.incentive_enabled}
                  onCheckedChange={(v) => set(key, { incentive_enabled: v })}
                />
              </div>
              <div className="w-64">
                <Text className="mb-1">Code (static text)</Text>
                <Input
                  defaultValue={config.incentive_code ?? ""}
                  key={`${key}-code-${config.incentive_code ?? ""}`}
                  placeholder="WELCOME10"
                  onBlur={(e) =>
                    set(key, { incentive_code: e.target.value || null })
                  }
                />
              </div>

              <Text className="pb-2">
                Sent: <strong>{sent}</strong>
              </Text>
            </div>
          </Container>
        );
      })}

      <Container className="px-6 py-4">
        <Button
          variant="secondary"
          onClick={() => {
            setNotice(null);
            queryClient.invalidateQueries({ queryKey: ["marketing-flows"] });
          }}
        >
          Refresh
        </Button>
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Marketing Automation",
});

export default FlowsPage;
