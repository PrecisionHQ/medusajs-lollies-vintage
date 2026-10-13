"use client";

import { useState } from "react";
import { useLocaleT } from "@/i18n/locale-context";
import { askQuestion } from "@lib/data/questions";

/**
 * Ask-a-Question popup (#11). The PDP extra-link row has always pointed at
 * #ask_question, but no modal with that id existed — the click was a
 * silent no-op. Guests may ask (no login wall); the shop answers in
 * Admin → Questions and the answer appears on the PDP.
 */
export default function AskQuestionModal({ productId }) {
  const t = useLocaleT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await askQuestion(productId, {
        name: name.trim(),
        email: email.trim(),
        question: question.trim(),
      });
      if (res.ok) {
        setSent(true);
      } else if (res.error === "ratelimited") {
        setError(t("product.askRatelimited"));
      } else {
        setError(res.error || t("product.sendFailed"));
      }
    } catch {
      setError(t("product.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="modal fade modal-ask-question"
      id="ask_question"
      data-testid="ask-modal"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="header">
            <h5 className="title">{t("product.askQuestion")}</h5>
            <span
              className="icon-close icon-close-popup"
              data-bs-dismiss="modal"
              data-testid="ask-modal-close"
            />
          </div>
          <div className="wrap">
            {sent ? (
              <p data-testid="ask-success">{t("product.askThanks")}</p>
            ) : (
              <form onSubmit={submit} className="d-flex flex-column gap-3">
                <input
                  className="form-control"
                  placeholder={t("product.askName")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="ask-name-input"
                />
                <input
                  className="form-control"
                  type="email"
                  placeholder={t("product.askEmail")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="ask-email-input"
                />
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder={t("product.askPlaceholder")}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  data-testid="ask-question-input"
                />
                {error && (
                  <div className="text-danger" data-testid="ask-error">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn-style-2 text-btn-uppercase"
                  disabled={sending}
                  data-testid="ask-submit"
                >
                  {sending ? t("product.sending") : t("product.askSend")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
