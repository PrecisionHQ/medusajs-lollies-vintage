import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type RedirectRow = { id: string; from: string; to: string; status: number };

/**
 * PR-15 — Redirects manager: single create, CSV bulk import, delete, and the
 * 404 log sorted by hits so the most painful dead ends get fixed first.
 */
const RedirectsPage = () => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [importText, setImportText] = useState("");

  const { data } = useQuery<{
    redirects: RedirectRow[];
    notFound: { path: string; hits: number; last_seen: string | null }[];
  }>({
    queryKey: ["redirects"],
    queryFn: () => sdk.client.fetch("/admin/redirects"),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["redirects"] });

  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/redirects", {
        method: "POST",
        body: { from, to },
      }),
    onSuccess: () => {
      setNotice("Saved.");
      setFrom("");
      setTo("");
      refresh();
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/redirects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice("Deleted.");
      refresh();
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  const doImport = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/redirects/import", {
        method: "POST",
        body: { csv: importText },
      }),
    onSuccess: (res: any) => {
      setNotice(
        `Imported: ${res.created} created, ${res.updated} updated` +
          (res.skipped?.length ? `, ${res.skipped.length} skipped` : "") +
          "."
      );
      setImportText("");
      refresh();
    },
    onError: (e: Error) => setNotice(`Import failed: ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Redirects</Heading>
        <Text className="text-ui-fg-subtle">
          Old paths → new paths for the Shopify migration.{" "}
          {notice ? `· ${notice}` : null}
        </Text>
      </Container>

      <Container className="px-6 py-4 flex flex-col gap-4">
        <Heading level="h3">New redirect</Heading>
        <div className="flex flex-wrap gap-4">
          <div className="w-80">
            <Text className="mb-1">From (old path)</Text>
            <Input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="/products/old-handle"
            />
          </div>
          <div className="w-80">
            <Text className="mb-1">To (new /path)</Text>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="/gb/products/new-handle"
            />
          </div>
        </div>
        <div>
          <Button
            onClick={() => create.mutate()}
            isLoading={create.isPending}
            disabled={!from.trim() || !to.trim()}
          >
            Save redirect
          </Button>
        </div>
        {(data?.redirects ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-4">
            <Text>
              {r.from} → {r.to} ({r.status})
            </Text>
            <Button variant="secondary" onClick={() => remove.mutate(r.id)}>
              Delete
            </Button>
          </div>
        ))}
      </Container>

      <Container className="px-6 py-4 flex flex-col gap-4">
        <Heading level="h3">Bulk import (from,to per line)</Heading>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={5}
          className="border border-ui-border-base rounded p-2 font-mono text-small-regular"
          placeholder="/products/a,/gb/products/a&#10;/collections/b,/gb/collections/b"
        />
        <div>
          <Button
            onClick={() => doImport.mutate()}
            isLoading={doImport.isPending}
            disabled={!importText.trim()}
          >
            Import
          </Button>
        </div>
      </Container>

      <Container className="px-6 py-4">
        <Heading level="h3">404 log (by hits)</Heading>
        {(data?.notFound ?? []).length === 0 ? (
          <Text className="text-ui-fg-subtle">No 404s recorded yet.</Text>
        ) : (
          (data?.notFound ?? []).map((l) => (
            <div key={l.path} className="flex items-center gap-4">
              <Text>
                {l.path} — {l.hits} hits
              </Text>
              <Button variant="secondary" onClick={() => setFrom(l.path)}>
                Redirect this
              </Button>
            </div>
          ))
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Redirects",
});

export default RedirectsPage;
