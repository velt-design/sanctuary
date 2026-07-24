'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/foundation';
import styles from './email-previews.module.css';

const variants = [
  { value: 'residential', label: 'Residential' },
  { value: 'residential-no-blinds', label: 'Residential without blinds' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'commercial-with-blinds', label: 'Commercial with blinds' },
  { value: 'professional', label: 'Professional' },
] as const;

type PreviewVariant = (typeof variants)[number]['value'];

type PreviewResponse = Readonly<{
  variant: PreviewVariant;
  label: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  recipient: string | null;
  sendReady: boolean;
  configurationReason: string;
}>;

function responseMessage(body: unknown, fallback: string): string {
  if (
    body
    && typeof body === 'object'
    && typeof (body as Record<string, unknown>).error === 'string'
  ) {
    return String((body as Record<string, unknown>).error);
  }
  return fallback;
}

export default function EmailPreviewClient() {
  const [variant, setVariant] = useState<PreviewVariant>('residential');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotice(null);

    void fetch(
      `/api/staff/v1/email-previews/website-autoresponder?variant=${encodeURIComponent(variant)}`,
      {
        cache: 'no-store',
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(responseMessage(body, 'Unable to load this email preview.'));
        }
        return body as PreviewResponse;
      })
      .then((body) => {
        setPreview(body);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setPreview(null);
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load this email preview.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [variant]);

  async function sendPreview() {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        '/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variant }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseMessage(body, 'Unable to send this email preview.'));
      }
      const recipient =
        body
        && typeof body === 'object'
        && typeof (body as Record<string, unknown>).recipient === 'string'
          ? String((body as Record<string, unknown>).recipient)
          : 'the configured review inbox';
      setNotice(`${preview?.label ?? 'Email'} preview sent to ${recipient}.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to send this email preview.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={styles.workspace} aria-label="Website autoresponder review">
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>Customer variant</p>
          <div className={styles.variants} aria-label="Choose an email variant">
            {variants.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.variant}
                aria-pressed={variant === option.value}
                onClick={() => setVariant(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.send}>
          <p className={styles.recipient}>
            {preview?.recipient
              ? `Fixed recipient: ${preview.recipient}`
              : 'The recipient is configured on the server.'}
          </p>
          <Button
            onClick={sendPreview}
            loading={sending}
            disabled={loading || !preview?.sendReady}
          >
            Send this fixture
          </Button>
        </div>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {loading ? (
        <div className={styles.loading}>Rendering the customer email…</div>
      ) : preview ? (
        <div className={styles.reviewGrid}>
          <aside className={styles.details}>
            <div className={styles.detail}>
              <span>Subject</span>
              <strong>{preview.subject}</strong>
            </div>
            <div className={styles.detail}>
              <span>Inbox preheader</span>
              <p>{preview.preheader}</p>
            </div>
            <div className={styles.detail}>
              <span>Delivery contract</span>
              <p>Fixture data only. No production BCC and no enquiry, contact, project, estimate, outbox or audit record.</p>
            </div>
            <details className={styles.plainText}>
              <summary>View plain-text version</summary>
              <pre>{preview.text}</pre>
            </details>
          </aside>

          <div className={styles.frameShell}>
            <div className={styles.frameBar}>
              <span>Rendered customer HTML</span>
              <span>{preview.label}</span>
            </div>
            <iframe
              className={styles.frame}
              title={`${preview.label} enquiry email preview`}
              srcDoc={preview.html}
              sandbox=""
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
