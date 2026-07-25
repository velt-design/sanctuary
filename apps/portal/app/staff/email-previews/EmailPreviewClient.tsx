'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/foundation';
import {
  previewBlindsOptions,
  previewConfigurationErrorMessage,
  previewConfigurationMessage,
  previewCustomerTypes,
  previewRoofForms,
  previewThemeOptions,
  previewVariantForSelection,
  previewViewportOptions,
  type PreviewBlindsOption,
  type PreviewConfigurationReason,
  type PreviewCustomerType,
  type PreviewLayoutId,
  type PreviewRoofForm,
  type PreviewTheme,
  type PreviewVariant,
  type PreviewViewport,
} from './emailPreviewOptions';
import styles from './email-previews.module.css';

type LayoutPreview = Readonly<{
  id: PreviewLayoutId;
  name: string;
  description: string;
  bestFor: string;
  subject: string;
  sendSubject: string;
  preheader: string;
  htmlLight: string;
  htmlDark: string;
  text: string;
}>;

type PreviewResponse = Readonly<{
  variant: PreviewVariant;
  label: string;
  layouts: readonly LayoutPreview[];
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

function SelectorButton<T extends string>(props: {
  value: T;
  selected: T;
  label: string;
  onSelect: (value: T) => void;
}) {
  return (
    <button
      type="button"
      className={styles.variant}
      aria-pressed={props.selected === props.value}
      onClick={() => props.onSelect(props.value)}
    >
      {props.label}
    </button>
  );
}

export default function EmailPreviewClient() {
  const [customerType, setCustomerType] =
    useState<PreviewCustomerType>('residential');
  const [roofForm, setRoofForm] = useState<PreviewRoofForm>('pitched');
  const [blinds, setBlinds] =
    useState<PreviewBlindsOption>('without-blinds');
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [theme, setTheme] = useState<PreviewTheme>('light');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingLayout, setSendingLayout] =
    useState<PreviewLayoutId | null>(null);
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
          throw new Error(
            responseMessage(body, 'Unable to load these email previews.'),
          );
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
            : 'Unable to load these email previews.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [variant]);

  async function sendPreview(layout: LayoutPreview) {
    setSendingLayout(layout.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        '/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variant, layout: layout.id }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          responseMessage(body, 'Unable to send this email preview.'),
        );
      }
      const recipient =
        body
        && typeof body === 'object'
        && typeof (body as Record<string, unknown>).recipient === 'string'
          ? String((body as Record<string, unknown>).recipient)
          : 'the configured review inbox';
      setNotice(`${layout.name} sent to ${recipient}.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to send this email preview.',
      );
    } finally {
      setSendingLayout(null);
    }
  }

  return (
    <section
      className={styles.workspace}
      aria-label="Website autoresponder layout comparison"
    >
      <div className={styles.toolbar}>
        <div className={styles.configurator}>
          <p className={styles.eyebrow}>Synchronized enquiry</p>
          <div className={styles.selectors}>
            <fieldset className={styles.selector}>
              <legend>Customer type</legend>
              <div className={styles.variants}>
                {previewCustomerTypes.map((option) => (
                  <SelectorButton
                    key={option.value}
                    {...option}
                    selected={customerType}
                    onSelect={setCustomerType}
                  />
                ))}
              </div>
            </fieldset>

            {customerType === 'professional' ? (
              <p className={styles.professionalNote}>
                Professional enquiries use the fixed KiwiRail Head Office
                reference.
              </p>
            ) : (
              <>
                <fieldset className={styles.selector}>
                  <legend>Roof form</legend>
                  <div className={styles.variants}>
                    {previewRoofForms.map((option) => (
                      <SelectorButton
                        key={option.value}
                        {...option}
                        selected={roofForm}
                        onSelect={setRoofForm}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset className={styles.selector}>
                  <legend>Outdoor blinds</legend>
                  <div className={styles.variants}>
                    {previewBlindsOptions.map((option) => (
                      <SelectorButton
                        key={option.value}
                        {...option}
                        selected={blinds}
                        onSelect={setBlinds}
                      />
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
          <p className={styles.safetyNote}>
            Preview delivery only: no production BCC or database records.
          </p>
        </div>
      </div>

      <div className={styles.viewToolbar}>
        <div>
          <p className={styles.eyebrow}>Comparison view</p>
          <p className={styles.viewHelp}>
            All three cards use the same enquiry data. Dark mode is a controlled
            simulation; the real inbox remains the final client test.
          </p>
        </div>
        <div className={styles.viewSelectors}>
          <fieldset className={styles.selector}>
            <legend>Viewport</legend>
            <div className={styles.variants}>
              {previewViewportOptions.map((option) => (
                <SelectorButton
                  key={option.value}
                  {...option}
                  selected={viewport}
                  onSelect={setViewport}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.selector}>
            <legend>Inbox theme</legend>
            <div className={styles.variants}>
              {previewThemeOptions.map((option) => (
                <SelectorButton
                  key={option.value}
                  {...option}
                  selected={theme}
                  onSelect={setTheme}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className={styles.loading}>Rendering three customer emails…</div>
      ) : preview ? (
        <>
          <div className={styles.selectionSummary}>
            <span>Comparing</span>
            <strong>{preview.label}</strong>
            <p>
              The live production autoresponder remains unchanged until one
              alternative is approved.
            </p>
          </div>

          <div
            className={styles.comparisonRail}
            data-preview-viewport={viewport}
            data-preview-theme={theme}
            aria-label={`${viewport} ${theme} email layout alternatives`}
          >
            {preview.layouts.map((layout, index) => (
              <article className={styles.layoutCard} key={layout.id}>
                <header className={styles.layoutHeader}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{layout.name}</h2>
                    <p>{layout.description}</p>
                  </div>
                </header>

                <div className={styles.layoutDecision}>
                  <span>Best for</span>
                  <p>{layout.bestFor}</p>
                </div>

                <div className={styles.inboxDetails}>
                  <div>
                    <span>Inbox test subject</span>
                    <strong>{layout.sendSubject}</strong>
                  </div>
                  <div>
                    <span>Preheader</span>
                    <p>{layout.preheader}</p>
                  </div>
                </div>

                <div className={styles.frameShell}>
                  <div className={styles.frameBar}>
                    <span>{viewport} · {theme}</span>
                    <span>{layout.name}</span>
                  </div>
                  <iframe
                    className={styles.frame}
                    title={`${layout.name} ${viewport} ${theme} enquiry email preview`}
                    srcDoc={
                      theme === 'dark' ? layout.htmlDark : layout.htmlLight
                    }
                    sandbox=""
                  />
                </div>

                <footer className={styles.layoutActions}>
                  <details className={styles.plainText}>
                    <summary>Plain-text version</summary>
                    <pre>{layout.text}</pre>
                  </details>
                  <Button
                    onClick={() => sendPreview(layout)}
                    loading={sendingLayout === layout.id}
                    disabled={
                      loading
                      || Boolean(sendingLayout)
                      || !preview.sendReady
                    }
                    aria-describedby="email-preview-send-status"
                  >
                    Send {layout.name}
                  </Button>
                </footer>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
