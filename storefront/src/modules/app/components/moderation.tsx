"use client"

import { useCallback, useEffect, useState } from "react"
import { appFetch, AppAuthError } from "@modules/app/backend"

type Question = {
  id: string
  name: string
  question: string
  answer: string | null
  status: string
  created_at: string
}

type Review = {
  id: string
  name: string
  rating: number
  title: string | null
  body: string
  status: string
  verified: boolean
  created_at: string
}

/**
 * Moderation — open questions (answer inline) + pending reviews
 * (approve/reject). Uses the same admin endpoints as the dashboard, so
 * rules stay in one place.
 */
export default function Moderation({ onAuthLost }: { onAuthLost: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const fail = (e: unknown) => {
    if (e instanceof AppAuthError) {
      onAuthLost()
      return
    }
    setError(e instanceof Error ? e.message : "Could not load.")
  }

  const load = useCallback(async () => {
    try {
      const [q, r] = await Promise.all([
        appFetch<{ questions: Question[] }>("/admin/questions?status=open"),
        appFetch<{ reviews: Review[] }>("/admin/reviews?status=pending"),
      ])
      setQuestions(q.questions)
      setReviews(r.reviews)
      setError(null)
    } catch (e) {
      fail(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="la-card">
        <div className="la-row">
          <h2 className="la-h2">Questions ({questions.length})</h2>
          <button className="la-btn-ghost" onClick={load}>Refresh</button>
        </div>
        {loading ? <p className="la-muted">Loading…</p> : null}
        {error ? <p className="la-err">{error}</p> : null}
        {!loading && !questions.length ? (
          <p className="la-muted">Queue clear.</p>
        ) : null}
        {questions.map((q) => (
          <div key={q.id} className="la-item">
            <p><strong>{q.name}</strong> <span className="la-muted">{new Date(q.created_at).toLocaleString()}</span></p>
            <p>{q.question}</p>
            <textarea
              className="la-textarea"
              placeholder="Write the answer…"
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
            <div className="la-actions">
              <button
                className="la-btn-ghost"
                disabled={busy === q.id || !(answers[q.id] ?? "").trim()}
                onClick={() =>
                  act(q.id, () =>
                    appFetch(`/admin/questions/${q.id}`, {
                      method: "POST",
                      body: JSON.stringify({ action: "answer", answer: answers[q.id] }),
                    })
                  )
                }
              >
                Answer
              </button>
              <button
                className="la-btn-ghost"
                disabled={busy === q.id}
                onClick={() =>
                  act(q.id, () =>
                    appFetch(`/admin/questions/${q.id}`, {
                      method: "POST",
                      body: JSON.stringify({ action: "close" }),
                    })
                  )
                }
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="la-card">
        <h2 className="la-h2">Reviews ({reviews.length})</h2>
        {!loading && !reviews.length ? (
          <p className="la-muted">Queue clear.</p>
        ) : null}
        {reviews.map((r) => (
          <div key={r.id} className="la-item">
            <p>
              <strong>{"★".repeat(r.rating)}</strong> · {r.name}
              {r.verified ? <span className="la-muted"> · verified</span> : null}
            </p>
            {r.title ? <p><strong>{r.title}</strong></p> : null}
            <p>{r.body}</p>
            <div className="la-actions">
              <button
                className="la-btn-ghost"
                disabled={busy === r.id}
                onClick={() =>
                  act(r.id, () =>
                    appFetch(`/admin/reviews/${r.id}`, {
                      method: "POST",
                      body: JSON.stringify({ action: "approve" }),
                    })
                  )
                }
              >
                Approve
              </button>
              <button
                className="la-btn-ghost"
                disabled={busy === r.id}
                onClick={() =>
                  act(r.id, () =>
                    appFetch(`/admin/reviews/${r.id}`, {
                      method: "POST",
                      body: JSON.stringify({ action: "reject" }),
                    })
                  )
                }
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
