import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Button,
  Container,
  FocusModal,
  Heading,
  Input,
  Label,
  StatusBadge,
  Text,
  Textarea,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type Campaign = {
  id: string;
  subject: string;
  headline: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
  product_handles: string | null;
  status: string;
  scheduled_at: string | null;
  sent?: number;
  failed?: number;
  updated_at?: string;
};

const EMPTY = {
  subject: "",
  headline: "",
  body: "",
  cta_label: "Shop now",
  cta_href: "/",
  product_handles: "",
  scheduled_at: "",
};

const statusColor = (status: string) =>
  status === "sent" ? "green" : status === "draft" ? "grey" : "orange";

/**
 * P2 — Campaign composer (batch sending lands in P3).
 * Drafts are created/edited here, previewed in an iframe, and test-sent
 * to a typed address. Non-draft campaigns are read-only.
 */
const CampaignsPage = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const { data, isLoading, error } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["marketing-campaigns"],
    queryFn: () => sdk.client.fetch("/admin/marketing/campaigns"),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof form & { id?: string }) => {
      const { id, ...body } = payload;
      return sdk.client.fetch(
        id ? `/admin/marketing/campaigns/${id}` : "/admin/marketing/campaigns",
        { method: "POST", body }
      );
    },
    onSuccess: () => {
      setNotice("Saved.");
      setIsNew(false);
      setEditingId(null);
      refresh();
    },
    onError: (e: Error) => setNotice(`Save failed: ${e.message}`),
  });

  const previewMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/campaigns/${id}/preview`, {
        method: "POST",
      }) as Promise<{ html: string }>,
    onSuccess: (res) => setPreviewHtml(res.html),
    onError: (e: Error) => setNotice(`Preview failed: ${e.message}`),
  });

  const testMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      sdk.client.fetch(`/admin/marketing/campaigns/${id}/test-send`, {
        method: "POST",
        body: { email },
      }),
    onSuccess: () => setNotice(`Test sent to ${testEmail}.`),
    onError: (e: Error) => setNotice(`Test failed: ${e.message}`),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/campaigns/${id}/send-now`, {
        method: "POST",
      }),
    onSuccess: () => {
      setNotice("Queued — the sender picks it up within 15 minutes.");
      refresh();
    },
    onError: (e: Error) => setNotice(`Queue failed: ${e.message}`),
  });

  const openNew = () => {
    setForm(EMPTY);
    setEditingId(null);
    setIsNew(true);
    setNotice(null);
  };

  const openEdit = (c: Campaign) => {
    setForm({
      subject: c.subject,
      headline: c.headline,
      body: c.body,
      cta_label: c.cta_label || "Shop now",
      cta_href: c.cta_href || "/",
      product_handles: c.product_handles || "",
      scheduled_at: c.scheduled_at ? c.scheduled_at.slice(0, 16) : "",
    });
    setEditingId(c.id);
    setIsNew(false);
    setNotice(null);
  };

  const set = (key: keyof typeof EMPTY) => (e: any) => {
    setNotice(null);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const editing = data?.campaigns.find((c) => c.id === editingId);
  const formOpen = isNew || editingId !== null;
  const editable = isNew || editing?.status === "draft";

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">Campaigns</Heading>
            <Text className="text-ui-fg-subtle">
              Compose newsletters and promos. Batch sending lands in P3 — for
              now, preview and test-send.
            </Text>
          </div>
          <Button onClick={openNew}>New campaign</Button>
        </div>
        {notice ? (
          <Text className="mt-2 text-ui-fg-subtle">{notice}</Text>
        ) : null}
      </Container>

      <Container className="px-6 py-4">
        <Heading level="h3" className="mb-3">
          All campaigns
        </Heading>
        {isLoading ? (
          <Text>Loading campaigns…</Text>
        ) : error || !data ? (
          <Text>
            Could not load campaigns: {(error as Error)?.message ?? "unknown"}
          </Text>
        ) : data.campaigns.length === 0 ? (
          <Text className="text-ui-fg-subtle">
            No campaigns yet — create the first one above.
          </Text>
        ) : (
          <div className="flex flex-col gap-2">
            {data.campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 border border-ui-border-base rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge color={statusColor(c.status) as any}>
                    {c.status}
                  </StatusBadge>
                  <Text className="font-medium truncate">{c.subject}</Text>
                  {(c.sent ?? 0) + (c.failed ?? 0) > 0 ? (
                    <Text className="text-ui-fg-subtle shrink-0">
                      {c.sent ?? 0} sent
                      {(c.failed ?? 0) > 0 ? `, ${c.failed} failed` : ""}
                    </Text>
                  ) : null}
                </div>
                <div className="flex gap-2 shrink-0">
                  {c.status === "draft" ? (
                    <Button variant="secondary" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                  ) : null}
                  {c.status === "draft" || c.status === "scheduled" ? (
                    <Button
                      variant="secondary"
                      onClick={() => sendMutation.mutate(c.id)}
                    >
                      Send now
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() => previewMutation.mutate(c.id)}
                  >
                    Preview
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>

      {formOpen ? (
        <Container className="px-6 py-4">
          <Heading level="h3" className="mb-3">
            {isNew ? "New campaign" : `Edit draft`}
            {!editable && editing ? (
              <span className="text-ui-fg-subtle"> (read-only: {editing.status})</span>
            ) : null}
          </Heading>
          <div className="flex flex-col gap-3 max-w-2xl">
            <div>
              <Label htmlFor="cp-subject">Subject</Label>
              <Input
                id="cp-subject"
                value={form.subject}
                onChange={set("subject")}
                disabled={!editable}
              />
            </div>
            <div>
              <Label htmlFor="cp-headline">Headline</Label>
              <Input
                id="cp-headline"
                value={form.headline}
                onChange={set("headline")}
                disabled={!editable}
              />
            </div>
            <div>
              <Label htmlFor="cp-body">Body (blank line = new paragraph)</Label>
              <Textarea
                id="cp-body"
                value={form.body}
                onChange={set("body")}
                rows={6}
                disabled={!editable}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cp-cta-label">Button text</Label>
                <Input
                  id="cp-cta-label"
                  value={form.cta_label}
                  onChange={set("cta_label")}
                  disabled={!editable}
                />
              </div>
              <div>
                <Label htmlFor="cp-cta-href">Button link</Label>
                <Input
                  id="cp-cta-href"
                  value={form.cta_href}
                  onChange={set("cta_href")}
                  placeholder="/ or https://…"
                  disabled={!editable}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cp-products">
                Products (handles, one per line, max 4)
              </Label>
              <Textarea
                id="cp-products"
                value={form.product_handles}
                onChange={set("product_handles")}
                rows={3}
                placeholder={"mila-dress-copy\nsasha"}
                disabled={!editable}
              />
            </div>
            <div>
              <Label htmlFor="cp-scheduled">Schedule for (optional, P3 sends it)</Label>
              <Input
                id="cp-scheduled"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={set("scheduled_at")}
                disabled={!editable}
              />
            </div>
            {editable ? (
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    saveMutation.mutate(
                      editingId ? { ...form, id: editingId } : form
                    )
                  }
                >
                  Save draft
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsNew(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
            {editingId && !isNew ? (
              <div className="flex items-end gap-2 pt-2 border-t border-ui-border-base">
                <div className="flex-1">
                  <Label htmlFor="cp-test-email">Test send to</Label>
                  <Input
                    id="cp-test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e: any) => setTestEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    testMutation.mutate({ id: editingId, email: testEmail })
                  }
                >
                  Send test
                </Button>
              </div>
            ) : null}
          </div>
        </Container>
      ) : null}

      <FocusModal open={previewHtml !== null} onOpenChange={(o: boolean) => !o && setPreviewHtml(null)}>
        <FocusModal.Content>
          <FocusModal.Header />
          <FocusModal.Body className="p-0">
            {previewHtml ? (
              <iframe
                title="Campaign preview"
                srcDoc={previewHtml}
                className="w-full h-full min-h-[70vh] border-0"
                sandbox="allow-same-origin"
              />
            ) : null}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Campaigns",
});

export default CampaignsPage;
