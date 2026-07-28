"use client";

import { useEffect, useState } from "react";
import styles from "./QuotesTab.module.css";

type QuoteEmailMode = "send" | "resend";
type PreviewMode = "desktop" | "narrow" | "text";

type QuoteEmailPreview = {
  subject: string;
  html: string;
  text: string | null;
};

type QuoteEmailPreviewPanelProps = {
  active: boolean;
  quoteVersionId: string;
  mode: QuoteEmailMode;
  to: string;
  subject: string;
  personalNote: string;
  attachmentNames: string[];
};

async function readPreviewError(response: Response): Promise<string> {
  const fallback = `Failed to render email preview (${response.status})`;
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : fallback;
  } catch {
    return fallback;
  }
}

export default function QuoteEmailPreviewPanel({
  active,
  quoteVersionId,
  mode,
  to,
  subject,
  personalNote,
  attachmentNames,
}: QuoteEmailPreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [preview, setPreview] = useState<QuoteEmailPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachmentSignature = attachmentNames.join("\n");

  useEffect(() => {
    if (!active || !quoteVersionId) return;

    const abortController = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void (async () => {
        try {
          const response = await fetch(
            `/api/quotes/${encodeURIComponent(quoteVersionId)}/preview`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "same-origin",
              cache: "no-store",
              signal: abortController.signal,
              body: JSON.stringify({
                mode,
                to: to
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                subject,
                personalNote,
                attachmentNames: attachmentSignature
                  ? attachmentSignature.split("\n")
                  : [],
              }),
            },
          );
          if (!response.ok) throw new Error(await readPreviewError(response));
          const rendered = (await response.json()) as QuoteEmailPreview;
          if (abortController.signal.aborted) return;
          setPreview(rendered);
        } catch (previewError) {
          if (abortController.signal.aborted) return;
          setPreview(null);
          setError(
            previewError instanceof Error
              ? previewError.message
              : "Failed to render email preview",
          );
        } finally {
          if (!abortController.signal.aborted) setLoading(false);
        }
      })();
    }, 220);

    return () => {
      abortController.abort();
      window.clearTimeout(timeout);
    };
  }, [
    active,
    attachmentSignature,
    mode,
    personalNote,
    quoteVersionId,
    subject,
    to,
  ]);

  return (
    <section className={styles.emailPreviewSection} aria-label="Customer email preview">
      <div className={styles.emailPreviewHeader}>
        <div>
          <div className={styles.metaLabel}>Customer email</div>
          <p className={styles.emailPreviewHint}>
            This is rendered by the same template used for delivery.
          </p>
        </div>
        <div
          className={styles.emailPreviewModeSwitch}
          role="tablist"
          aria-label="Email preview width"
        >
          {(
            [
              ["desktop", "Desktop"],
              ["narrow", "Narrow"],
              ["text", "Plain text"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={previewMode === value}
              className={`${styles.emailPreviewModeButton} ${previewMode === value ? styles.emailPreviewModeButtonActive : ""}`}
              onClick={() => setPreviewMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className={styles.note} aria-live="polite">
          Rendering email preview...
        </p>
      ) : null}
      {error ? <div className={styles.errorText}>{error}</div> : null}
      {!loading && !error && !preview ? (
        <p className={styles.note}>No email preview available.</p>
      ) : null}
      {preview ? (
        <>
          <div className={styles.emailPreviewSubject}>
            <span>Subject</span>
            <strong>{preview.subject}</strong>
          </div>
          {previewMode === "text" ? (
            <pre className={styles.emailTextPreview}>{preview.text ?? ""}</pre>
          ) : (
            <div
              className={`${styles.emailPreviewViewport} ${
                previewMode === "narrow"
                  ? styles.emailPreviewViewportNarrow
                  : styles.emailPreviewViewportDesktop
              }`}
            >
              <iframe
                title={`Quote email ${previewMode} preview`}
                className={styles.emailPreviewFrame}
                sandbox=""
                srcDoc={preview.html}
              />
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
