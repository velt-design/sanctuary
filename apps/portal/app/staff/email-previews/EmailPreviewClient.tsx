'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/foundation';
import {
  previewBlindsOptions,
  previewConfigurationErrorMessage,
  previewConfigurationMessage,
  previewCustomerTypes,
  previewRoofForms,
  previewVariantForSelection,
  type PreviewBlindsOption,
  type PreviewConfigurationReason,
  type PreviewCustomerType,
  type PreviewRoofForm,
  type PreviewVariant,
} from './emailPreviewOptions';
import styles from './email-previews.module.css';

type PreviewResponse = Readonly<{
  variant: PreviewVariant;
  label: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  recipient: string | null;
  sendReady: boolean;
  configurationReason: PreviewConfigurationReason;
}>;

function responseMessage(body: unknown, fallback: string): string {
  const configurationMessage = previewConfigurationErrorMessage(body);
  if (configurationMessage) return configurationMessage;
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
  const [customerType, setCustomerType] =
    useState<PreviewCustomerType>('residential');
  const [roofForm, setRoofForm] = useState<PreviewRoofForm>('pitched');
  const [blinds, setBlinds] =
    useState<PreviewBlindsOption>('without-blinds');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const variant = previewVariantForSelection(customerType, roofForm, blinds);

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
        <div className={styles.configurator}>
          <p className={styles.eyebrow}>Preview configuration</p>
          <div className={styles.selectors}>
            <fieldset className={styles.selector}>
              <legend>Customer type</legend>
              <div className={styles.variants}>
                {previewCustomerTypes.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={styles.variant}
                    aria-pressed={customerType === option.value}
                    onClick={() => setCustomerType(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {customerType === 'professional' ? (
              <p className={styles.professionalNote}>
                Professional enquiries use the fixed KiwiRail Head Office reference.
              </p>
            ) : (
              <>
                <fieldset className={styles.selector}>
                  <legend>Roof form</legend>
                  <div className={styles.variants}>
                    {previewRoofForms.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={styles.variant}
                        aria-pressed={roofForm === option.value}
                        onClick={() => setRoofForm(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className={styles.selector}>
                  <legend>Outdoor blinds</legend>
                  <div className={styles.variants}>
                    {previewBlindsOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={styles.variant}
                        aria-pressed={blinds === option.value}
                        onClick={() => setBlinds(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
          </div>
        </div>

        <div className={styles.send}>
          <p className={styles.recipient}>
            {preview?.recipient
              ? `Fixed recipient: ${preview.recipient}`
              : 'The recipient is configured on the server.'}
          </p>
          {preview ? (
            <p
              id="email-preview-send-status"
              className={
                preview.sendReady
                  ? styles.sendStatusReady
                  : styles.sendStatusWarning
              }
              role="status"
            >
              {previewConfigurationMessage(preview.configurationReason)}
            </p>
          ) : null}
          <Button
            onClick={sendPreview}
            loading={sending}
            disabled={loading || !preview?.sendReady}
            aria-describedby="email-preview-send-status"
          >
            Send this preview
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
