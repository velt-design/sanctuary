"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/modal/Modal";
import { Button, ButtonLink, DataStatePanel } from "@/components/ui/foundation";
import { ApiError } from "@/lib/repo/apiClient";
import type { DepositInvoiceArtifactPreview } from "@/lib/invoices/types";
import {
  depositInvoicePdfPreviewUrl,
  loadDepositInvoiceArtifactPreview,
} from "@/lib/repo/invoicesRepo";
import styles from "./InvoiceArtifactPreviewDialog.module.css";
import InvoicePdfInlinePreview from './InvoicePdfInlinePreview';

type PreviewMode = "pdf" | "email" | "narrow" | "text";

type Props = {
  invoiceId: string;
  invoiceRef: string;
  onClose: () => void;
  initialPreview?: DepositInvoiceArtifactPreview;
  pdfPreviewUrl?: string;
};

export default function InvoiceArtifactPreviewDialog(props: Props) {
  return <InvoiceArtifactPreviewContent key={props.invoiceId} {...props} />;
}

function InvoiceArtifactPreviewContent({
  invoiceId,
  invoiceRef,
  onClose,
  initialPreview,
  pdfPreviewUrl,
}: Props) {
  const [mode, setMode] = useState<PreviewMode>("pdf");
  const verifiedInitialPreview = initialPreview?.invoiceId === invoiceId ? initialPreview : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; preview?: DepositInvoiceArtifactPreview; error?: string; denied?: boolean } | null>(
    verifiedInitialPreview ? { attempt: 0, preview: verifiedInitialPreview } : null,
  );
  const current = result?.attempt === attempt ? result : null;
  const preview = current?.preview;
  const error = current?.error;
  const loading = !current;

  useEffect(() => {
    if (verifiedInitialPreview) return;
    const controller = new AbortController();
    void loadDepositInvoiceArtifactPreview(invoiceId)
      .then((result) => {
        if (result.invoiceId !== invoiceId) throw new Error("Invoice preview identity did not match.");
        if (!controller.signal.aborted) setResult({ attempt, preview: result });
      })
      .catch((previewError) => {
        if (controller.signal.aborted) return;
        setResult({ attempt, denied: previewError instanceof ApiError && [401, 403, 404].includes(previewError.status), error: previewError instanceof Error
          ? previewError.message : "Invoice preview is unavailable" });
      });
    return () => controller.abort();
  }, [verifiedInitialPreview, invoiceId, attempt]);

  const recipients = useMemo(() => {
    if (!preview) return ["To", "CC", "BCC"].map((label) => ({ label, value: loading ? "Reading…" : "Unavailable" }));
    const unresolved = "Resolved when delivery is prepared";
    const empty = preview.source === "prepared" ? "None" : unresolved;
    return [
      { label: "To", value: preview.recipients.to.join(", ") || empty },
      { label: "CC", value: preview.recipients.cc.join(", ") || empty },
      { label: "BCC", value: preview.recipients.bcc.join(", ") || empty },
    ];
  }, [preview, loading]);

  const unknown = loading ? "Reading…" : "Unavailable";
  const pdfUrl = pdfPreviewUrl ?? depositInvoicePdfPreviewUrl(invoiceId);

  return (
    <Modal
      open
      onClose={onClose}
      ariaLabel={`Preview invoice ${invoiceRef}`}
      maxWidthPx={1160}
      panelClassName={styles.panel}
    >
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Customer artifact preview</span>
          <h2 className={styles.title}>{invoiceRef}</h2>
          <p className={styles.summary}>
            Review the PDF, responsive email, and plain-text fallback without
            sending or changing the invoice.
          </p>
        </div>
        <Button type="button" variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>

      {loading ? (
        <p className={styles.status} aria-live="polite">
          Rendering invoice preview...
        </p>
      ) : null}

      {error ? (
        <div className={styles.state}>
          <DataStatePanel
            state="error"
            title="Invoice preview unavailable"
            description={error}
            onRetry={() => setAttempt((value) => value + 1)}
          />
        </div>
      ) : null}

      <>
          <div className={styles.deliverySummary} aria-busy={loading}>
            <div>
              <span>Subject</span>
              <strong>{preview?.subject ?? unknown}</strong>
            </div>
            <div>
              <span>Recipients</span>
              <dl className={styles.recipientList}>
                {recipients.map((recipient) => (
                  <div key={recipient.label}>
                    <dt>{recipient.label}</dt>
                    <dd>{recipient.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <span>Attachments</span>
              <strong>
                {preview ? preview.attachmentNames.join(", ") ||
                  (preview.source === "prepared"
                    ? "No attachment recorded"
                    : "Resolved when delivery is prepared") : unknown}
              </strong>
            </div>
          </div>

          <p className={styles.previewNotice}>
            {!preview ? (loading ? "Reading delivery content…" : "Delivery content unavailable.") : preview.source === "prepared"
              ? "This is the frozen delivery content. The customer token is redacted in this staff preview."
              : "This uses the delivery renderer with an inert customer link. Recipients and the private token are resolved only when delivery is prepared."}
          </p>

          <div
            className={styles.modeSwitch}
            role="group"
            aria-label="Invoice artifact preview"
          >
            {(
              [
                ["pdf", "PDF"],
                ["email", "Email desktop"],
                ["narrow", "Email narrow"],
                ["text", "Plain text"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                className={mode === value ? styles.modeActive : styles.mode}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "pdf" ? (
            <div className={styles.previewBlock}>
              <div className={styles.previewToolbar}>
                <span>Read-only PDF preview</span>
                <ButtonLink
                  href={pdfUrl}
                  aria-disabled={current?.denied || undefined}
                  onClick={(event) => { if (current?.denied) event.preventDefault(); }}
                  target="_blank"
                  rel="noreferrer"
                  variant="secondary"
                  size="small"
                >
                  Open PDF
                </ButtonLink>
              </div>
              <div className={styles.pdfDocument} aria-label={`Invoice ${invoiceRef} PDF preview`}>
                <InvoicePdfInlinePreview url={pdfUrl} readVersion={attempt} enabled={!current?.denied} />
              </div>
            </div>
          ) : null}

          {mode === "email" || mode === "narrow" ? (
            <div
              className={`${styles.emailViewport} ${
                mode === "narrow"
                  ? styles.emailViewportNarrow
                  : styles.emailViewportDesktop
              }`}
            >
              <iframe
                className={styles.emailFrame}
                sandbox=""
                srcDoc={preview?.html}
                title={`Invoice ${invoiceRef} ${mode === "narrow" ? "narrow" : "desktop"} email preview`}
              />
            </div>
          ) : null}

          {mode === "text" ? (
            <pre className={styles.textPreview}>{preview?.text ?? (preview ? "" : unknown)}</pre>
          ) : null}
      </>
    </Modal>
  );
}
