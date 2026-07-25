import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import EmailPreviewClient from './EmailPreviewClient';

function previewResponse(
  variant: string,
  options: { sendReady?: boolean; reason?: string } = {},
) {
  return {
    variant,
    label: variant === 'professional'
      ? 'Professional'
      : variant.split('-').join(' '),
    subject: "Alex, we've received your pergola enquiry",
    preheader: 'Your project details and next steps from Sanctuary.',
    html: '<html><body>Rendered preview</body></html>',
    text: 'Rendered preview',
    recipient: 'jordan@sanctuarypergolas.co.nz',
    sendReady: options.sendReady ?? false,
    configurationReason: options.reason ?? 'missing_api_key',
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

describe('EmailPreviewClient', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { variant: string };
          return Response.json({
            ok: true,
            variant: body.variant,
            recipient: 'jordan@sanctuarypergolas.co.nz',
            subject: "Alex, we've received your pergola enquiry",
            preheader: 'Your project details and next steps from Sanctuary.',
            providerMessageId: 'preview-message-1',
          });
        }
        const variant = new URL(url, 'http://localhost').searchParams.get('variant')!;
        return Response.json(previewResponse(variant));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('offers all selector dimensions and explains why Send is disabled', async () => {
    const rendered = renderIntoDocument(<EmailPreviewClient />);
    await flushEffects();

    expect(button(rendered.container, 'Residential').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(button(rendered.container, 'Pitched').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      button(rendered.container, 'Without blinds').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(button(rendered.container, 'Send this preview').disabled).toBe(true);
    expect(rendered.container.textContent).toContain('RESEND_API_KEY_PREVIEW');
    expect(rendered.container.textContent).toContain('actual Resend secret value');
    expect(rendered.container.textContent).toContain('redeploy this branch');

    await act(async () => {
      button(rendered.container, 'Commercial').click();
      await Promise.resolve();
    });
    await flushEffects();
    await act(async () => {
      button(rendered.container, 'Gable').click();
      await Promise.resolve();
    });
    await flushEffects();
    await act(async () => {
      button(rendered.container, 'With blinds').click();
      await Promise.resolve();
    });
    await flushEffects();

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/staff/v1/email-previews/website-autoresponder?variant=commercial-gable-with-blinds',
      expect.objectContaining({ cache: 'no-store' }),
    );

    await act(async () => {
      button(rendered.container, 'Professional').click();
      await Promise.resolve();
    });
    await flushEffects();

    expect(rendered.container.textContent).toContain(
      'Professional enquiries use the fixed KiwiRail Head Office reference.',
    );
    expect(
      Array.from(rendered.container.querySelectorAll('legend')).map(
        (legend) => legend.textContent,
      ),
    ).toEqual(['Customer type']);
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/staff/v1/email-previews/website-autoresponder?variant=professional',
      expect.objectContaining({ cache: 'no-store' }),
    );

    rendered.unmount();
  });

  it('enables delivery only when the server reports ready and sends the selected fixture', async () => {
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { variant: string };
          return Response.json({
            ok: true,
            variant: body.variant,
            recipient: 'jordan@sanctuarypergolas.co.nz',
            subject: "Alex, we've received your pergola enquiry",
            preheader: 'Your project details and next steps from Sanctuary.',
            providerMessageId: 'preview-message-1',
          });
        }
        const variant = new URL(String(input), 'http://localhost').searchParams.get(
          'variant',
        )!;
        return Response.json(
          previewResponse(variant, { sendReady: true, reason: 'ready' }),
        );
      },
    );

    const rendered = renderIntoDocument(<EmailPreviewClient />);
    await flushEffects();

    const send = button(rendered.container, 'Send this preview');
    expect(send.disabled).toBe(false);
    expect(rendered.container.textContent).toContain(
      'Ready to send from this preview deployment.',
    );

    await act(async () => {
      send.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/staff/v1/email-previews/website-autoresponder',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          variant: 'residential-pitched-without-blinds',
        }),
      }),
    );
    expect(rendered.container.textContent).toContain(
      'preview sent to jordan@sanctuarypergolas.co.nz',
    );

    rendered.unmount();
  });
});
