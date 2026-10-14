import { defineRouteConfig } from "@medusajs/admin-sdk";
import { SeoIcon } from "../../components/module-icons";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type Row = {
  id: string;
  title: string;
  handle: string;
  noImage: boolean;
  noDesc: boolean;
  thinDesc: boolean;
};

const strip = (html?: string | null) =>
  (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/**
 * SEO health report: every product's discoverability gaps in one table.
 * Missing thumbnails break OG cards + JSON-LD images; missing/thin
 * descriptions weaken PDP metadata + structured data. Read-only: fixes
 * happen in Products, this page just points at them.
 */
const SeoPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error } = useQuery<{
    rows: Row[];
    totals: { products: number; noImage: number; noDesc: number; thinDesc: number };
  }>({
    queryKey: ["seo-health", refreshKey],
    queryFn: async () => {
      const rows: Row[] = [];
      let offset = 0;
      for (let page = 0; page < 5; page++) {
        const res = (await sdk.client.fetch(
          `/admin/products?limit=100&offset=${offset}&fields=id,title,handle,thumbnail,description,status`
        )) as any;
        const products = res?.products || [];
        if (!products.length) break;
        offset += products.length;
        for (const p of products) {
          const desc = strip(p.description);
          rows.push({
            id: p.id,
            title: p.title || p.handle,
            handle: p.handle,
            noImage: !p.thumbnail,
            noDesc: desc.length === 0,
            thinDesc: desc.length > 0 && desc.length < 50,
          });
        }
        if (products.length < 100) break;
      }
      return {
        rows,
        totals: {
          products: rows.length,
          noImage: rows.filter((r) => r.noImage).length,
          noDesc: rows.filter((r) => r.noDesc).length,
          thinDesc: rows.filter((r) => r.thinDesc).length,
        },
      };
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">SEO health</Heading>
            <Text className="text-ui-fg-subtle">
              Products missing the fields search engines need. Fix in
              Products; this page only reports.
            </Text>
          </div>
          <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>
            Refresh
          </Button>
        </div>
      </Container>

      <Container className="px-6 py-4">
        {isLoading ? (
          <Text>Scanning catalog…</Text>
        ) : error || !data ? (
          <Text>
            Could not load products: {(error as Error)?.message ?? "unknown"}
          </Text>
        ) : (
          <>
            <div className="flex gap-6 mb-4">
              <Text>
                <span className="font-semibold">{data.totals.products}</span> products
              </Text>
              <Text>
                <span className="font-semibold">{data.totals.noImage}</span> no image
              </Text>
              <Text>
                <span className="font-semibold">{data.totals.noDesc}</span> no description
              </Text>
              <Text>
                <span className="font-semibold">{data.totals.thinDesc}</span> thin (&lt;50
                chars)
              </Text>
            </div>
            <div className="flex flex-col gap-1 max-h-[60vh] overflow-auto">
              {data.rows
                .filter((r) => r.noImage || r.noDesc || r.thinDesc)
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 border border-ui-border-base rounded-lg px-4 py-2"
                  >
                    <Text className="font-medium truncate">
                      {r.title}{" "}
                      <span className="text-ui-fg-subtle">/{r.handle}</span>
                    </Text>
                    <Text className="text-ui-fg-subtle shrink-0">
                      {[
                        r.noImage ? "no image" : null,
                        r.noDesc ? "no description" : null,
                        r.thinDesc ? "thin description" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
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
  icon: SeoIcon,
  label: "SEO",
});

export default SeoPage;
