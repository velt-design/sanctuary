"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/modal/Modal";
import { Button, ButtonLink, DataStatePanel } from "@/components/ui/foundation";
import type { DepositInvoiceArtifactPreview } from "@/lib/invoices/types";
import {
  depositInvoicePdfPreviewUrl,
  loadDepositInvoiceArtifactPreview,
} from "@/lib/repo/invoicesRepo";
import styles from "./InvoiceArtifactPreviewDialog.module.css";

type PreviewMode = "pdf" | "email" | "narrow" | "text";

export default function InvoiceArtifactPreviewDialog({
  invoiceId,
  invoiceRef,
  onClose,
  initialPreview,
  pdfPreviewUrl,
}: {
  invoiceId: string;
  invoiceRef: string;
  onClose: () => void;
  initialPreview?: DepositInvoiceArtifactPreview;
  pdfPreviewUrl?: string;
}) {
  const [mode, setMode] = useState<PreviewMode>("pdf");
  const [preview, setPreview] = useState<DepositInvoiceArtifactPreview | null>(
    initialPreview ?? null,
  );
  const [loading, setLoading] = useState(!initialPreview);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPreview) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void loadDepositInvoiceArtifactPreview(invoiceId)
      .then((result) => {
        if (!controller.signal.aborted) setPreview(result);
      })
      .catch((previewError) => {
        if (controller.signal.aborted) return;
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Invoice preview is unavailable",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [initialPreview, invoiceId]);

  const recipients = useMemo(() => {
    if (!preview) return [];
    const unresolved = "Resolved when delivery is prepared";
    const empty = preview.source === "prepared" ? "None" : unresolved;
    return [
      { label: "To", value: preview.recipients.to.join(", ") || empty },
      { label: "CC", value: preview.recipients.cc.join(", ") || empty },
      { label: "BCC", value: preview.recipients.bcc.join(", ") || empty },
    ];
  }, [preview]);

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
          />
        </div>
      ) : null}

      {preview ? (
        <>
          <div className={styles.deliverySummary}>
            <div>
              <span>Subject</span>
              <strong>{preview.subject}</strong>
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
                {preview.attachmentNames.join(", ") ||
                  (preview.source === "prepared"
                    ? "No attachment recorded"
                    : "Resolved when delivery is prepared")}
              </strong>
            </div>
          </div>

          <p className={styles.previewNotice}>
            {preview.source === "prepared"
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
                  target="_blank"
                  rel="noreferrer"
                  variant="secondary"
                  size="small"
                >
                  Open PDF
                </ButtonLink>
              </div>
              <iframe
                className={styles.pdfFrame}
                src={pdfUrl}
                title={`Invoice ${invoiceRef} PDF preview`}
              />
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
                srcDoc={preview.html}
                title={`Invoice ${invoiceRef} ${mode === "narrow" ? "narrow" : "desktop"} email preview`}
              />
            </div>
          ) : null}

          {mode === "text" ? (
            <pre className={styles.textPreview}>{preview.text ?? ""}</pre>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
