import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type VariantRow = {
  id: string;
  title: string;
  sku: string | null;
  prices: { currency_code: string; amount: number }[];
};

/**
 * PR-11 — Pricing matrix + bulk CSV + audit.
 *
 * Matrix: pick a product, edit per-currency prices (minor units shown as
 * major for humans — the inputs take euros/pounds/etc. and convert). No
 * compare-at: variant prices have no such field in 2.19; sales come from
 * promotions. Export downloads the CSV, import pastes it back (skips bad
 * rows, reports them). Audit lists variants missing an active currency
 * (unsellable there) and zero-decimal currency flags.
 */
const PricingPage = () => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [importText, setImportText] = useState("");

  const { data: products } = useQuery<{ products: any[] }>({
    queryKey: ["pricing-search", search],
    queryFn: () =>
      sdk.client.fetch("/admin/products", { query: { q: search, limit: 10 } }),
    enabled: search.trim().length >= 2,
  });

  const { data: matrix } = useQuery<{
    product: { id: string; title: string };
    variants: VariantRow[];
  }>({
    queryKey: ["pricing-matrix", productId],
    queryFn: () =>
      sdk.client.fetch("/admin/pricing", { query: { product_id: productId } }),
    enabled: !!productId,
  });

  const { data: regions } = useQuery<{ regions: { currency_code: string }[] }>({
    queryKey: ["pricing-regions"],
    queryFn: () => sdk.client.fetch("/admin/regions", { query: { limit: 100 } }),
  });
  const currencies = [
    ...new Set((regions?.regions ?? []).map((r) => r.currency_code)),
  ];

  const { data: audit } = useQuery<{
    missing: any[];
    missing_count: number;
    zeroDecimal: any[];
  }>({
    queryKey: ["pricing-audit"],
    queryFn: () => sdk.client.fetch("/admin/pricing/audit"),
  });

  const save = useMutation({
    mutationFn: () => {
      const variantPrices = (matrix?.variants ?? [])
        .map((v) => {
          const prices = currencies
            .map((c) => {
              const raw = draft[v.id]?.[c];
              if (raw === undefined || raw === "") {
                return null;
              }
              const major = Number(String(raw).replace(",", "."));
              if (!Number.isFinite(major) || major < 0) {
                throw new Error(`Bad amount for ${v.sku ?? v.id} / ${c}`);
              }
              return { currency_code: c, amount: Math.round(major * 100) };
            })
            .filter((p): p is { currency_code: string; amount: number } => !!p);
          return prices.length
            ? { variant_id: v.id, product_id: matrix!.product.id, prices }
            : null;
        })
        .filter((vp): vp is NonNullable<typeof vp> => !!vp);
      return sdk.client.fetch("/admin/pricing", {
        method: "POST",
        body: { variantPrices },
      });
    },
    onSuccess: (res: any) => {
      setNotice(`Saved ${res.updated ?? 0} variants.`);
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ["pricing-matrix"] });
      queryClient.invalidateQueries({ queryKey: ["pricing-audit"] });
    },
    onError: (e: Error) => setNotice(`Save failed: ${e.message}`),
  });

  const doImport = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/pricing/import", {
        method: "POST",
        body: { csv: importText },
      }),
    onSuccess: (res: any) => {
      setNotice(
        `Imported ${res.updated} rows${res.skipped?.length ? `, skipped ${res.skipped.length} (see console)` : ""}.`
      );
      console.info("pricing import skipped:", res.skipped);
      setImportText("");
      queryClient.invalidateQueries({ queryKey: ["pricing-audit"] });
    },
    onError: (e: Error) => setNotice(`Import failed: ${e.message}`),
  });

  const cell = (v: VariantRow, c: string): string => {
    const fromDraft = draft[v.id]?.[c];
    if (fromDraft !== undefined) {
      return fromDraft;
    }
    const minor = v.prices.find((p) => p.currency_code === c)?.amount;
    return minor == null ? "" : String(minor / 100);
  };

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Pricing</Heading>
        <Text className="text-ui-fg-subtle">
          Per-currency variant prices (one currency per region today). Amounts
          in major units. {notice ? `· ${notice}` : null}
        </Text>
      </Container>

      <Container className="px-6 py-4 flex flex-col gap-4">
        <Heading level="h3">Matrix</Heading>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="max-w-md"
        />
        {(products?.products ?? []).map((p: any) => (
          <div key={p.id}>
            <Button variant="secondary" onClick={() => setProductId(p.id)}>
              {p.title}
            </Button>
          </div>
        ))}
        {matrix ? (
          <div className="flex flex-col gap-2">
            <Text className="font-semibold">{matrix.product.title}</Text>
            <table>
              <thead>
                <tr>
                  <th className="text-left">Variant</th>
                  {currencies.map((c) => (
                    <th key={c} className="text-left">
                      {c.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.variants.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.title} ({v.sku ?? v.id.slice(-6)})
                    </td>
                    {currencies.map((c) => (
                      <td key={c}>
                        <Input
                          value={cell(v, c)}
                          className="w-28"
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [v.id]: { ...(draft[v.id] ?? {}), [c]: e.target.value },
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <Button onClick={() => save.mutate()} isLoading={save.isPending}>
                Save prices
              </Button>
            </div>
          </div>
        ) : null}
      </Container>

      <Container className="px-6 py-4 flex flex-col gap-4">
        <Heading level="h3">Bulk CSV</Heading>
        <div>
          <a
            href="/admin/pricing/export"
            className="underline"
            download="prices.csv"
          >
            Download prices.csv
          </a>
        </div>
        <Text>Paste edited CSV to import (bad rows are skipped and reported):</Text>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={6}
          className="border border-ui-border-base rounded p-2 font-mono text-small-regular"
          placeholder="variant_id,product_handle,sku,variant_title,price_eur,price_gbp,…"
        />
        <div>
          <Button
            onClick={() => doImport.mutate()}
            isLoading={doImport.isPending}
            disabled={!importText.trim()}
          >
            Import CSV
          </Button>
        </div>
      </Container>

      <Container className="px-6 py-4">
        <Heading level="h3">
          Audit ({audit?.missing_count ?? "…"} variants missing a currency)
        </Heading>
        {(audit?.missing ?? []).slice(0, 20).map((m: any, i: number) => (
          <Text key={i}>
            {m.product} / {m.sku ?? m.variant_id}: missing{" "}
            {m.missing_currencies.join(", ").toUpperCase()}
          </Text>
        ))}
        {(audit?.missing_count ?? 0) > 20 ? (
          <Text>…and {audit!.missing_count - 20} more.</Text>
        ) : null}
        {(audit?.zeroDecimal?.length ?? 0) > 0 ? (
          <Text>
            {audit!.zeroDecimal.length} prices in zero-decimal currencies — review
            before those go live.
          </Text>
        ) : null}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Pricing",
});

export default PricingPage;
