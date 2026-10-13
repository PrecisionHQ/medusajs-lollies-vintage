import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type QuestionRow = {
  id: string;
  product_id: string;
  name: string;
  email: string;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
};

/**
 * Q&A queue (#11). Open questions land here from the PDP ask form; write
 * an answer to publish it on the storefront, close to dismiss.
 */
const QuestionsPage = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const [notice, setNotice] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery<{
    questions: QuestionRow[];
    count: number;
  }>({
    queryKey: ["questions", status],
    queryFn: () =>
      sdk.client.fetch("/admin/questions", { query: { status, take: 50 } }),
  });

  const mutation = useMutation({
    mutationFn: ({
      id,
      action,
      answer,
    }: {
      id: string;
      action: string;
      answer?: string;
    }) =>
      sdk.client.fetch(`/admin/questions/${id}`, {
        method: "POST",
        body: { action, answer },
      }),
    onSuccess: () => {
      setNotice("Saved.");
      setAnswers({});
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: (e: Error) => setNotice(`Failed: ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <Container className="px-6 py-4">
        <Heading level="h2">Questions</Heading>
        <Text className="text-ui-fg-subtle">
          {data ? `${data.count} ${status}` : "Answer shopper questions."}{" "}
          {notice ? `· ${notice}` : null}
        </Text>
        <div className="flex gap-2 mt-2">
          {["open", "answered", "closed"].map((s) => (
            <Button
              key={s}
              variant={status === s ? "primary" : "secondary"}
              onClick={() => setStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </Container>

      {isLoading ? (
        <Container>
          <Text>Loading…</Text>
        </Container>
      ) : null}
      {error ? (
        <Container>
          <Text>Could not load questions: {(error as Error).message}</Text>
        </Container>
      ) : null}

      {(data?.questions ?? []).map((q) => (
        <Container key={q.id} className="px-6 py-4">
          <Text>
            <strong>Q:</strong> {q.question}
          </Text>
          {q.answer ? (
            <Text>
              <strong>A:</strong> {q.answer}
            </Text>
          ) : null}
          <Text className="text-ui-fg-subtle">
            {q.name} · {q.email} · {q.product_id} ·{" "}
            {new Date(q.created_at).toLocaleDateString()}
          </Text>
          {q.status !== "closed" ? (
            <div className="flex gap-2 mt-2">
              <input
                className="flex-1 border rounded px-2 py-1"
                placeholder="Write the answer…"
                value={answers[q.id] ?? q.answer ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
              />
              <Button
                onClick={() =>
                  mutation.mutate({
                    id: q.id,
                    action: "answer",
                    answer: answers[q.id] ?? q.answer ?? "",
                  })
                }
              >
                Answer
              </Button>
              <Button
                variant="secondary"
                onClick={() => mutation.mutate({ id: q.id, action: "close" })}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="mt-2">
              <Button
                variant="secondary"
                onClick={() => mutation.mutate({ id: q.id, action: "reopen" })}
              >
                Reopen
              </Button>
            </div>
          )}
        </Container>
      ))}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Questions",
});

export default QuestionsPage;
