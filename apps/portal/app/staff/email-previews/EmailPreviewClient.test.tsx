import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import EmailPreviewClient from './EmailPreviewClient';

const layouts = [
  {
    id: 'editorial-refined',
    name: 'Editorial Refined',
    description: 'Polished editorial layout.',
    bestFor: 'Balanced brand expression.',
  },
  {
    id: 'image-led',
    name: 'Image-led',
    description: 'Photography-led layout.',
    bestFor: 'Visual impact.',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Scannable compact layout.',
    bestFor: 'Fast scanning.',
  },
] as const;

function previewResponse(
  variant: string,
  options: { sendReady?: boolean; reason?: string } = {},
) {
  return {
    variant,
    label:
      variant === 'professional'
        ? 'Professional'
        : variant.split('-').join(' '),
    layouts: layouts.map((layout) => ({
      ...layout,
      subject: "Alex, we've received your pergola enquiry",
      sendSubject: `[Preview: ${layout.name}] Alex, we've received your pergola enquiry`,
      preheader: 'Your project details and next steps from Sanctuary.',
      htmlLight: `<html class="sp-preview-light"><body>${layout.id} light</body></html>`,
      htmlDark: `<html class="sp-preview-dark"><body>${layout.id} dark</body></html>`,
      text: `${layout.name} plain text`,
    })),
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
  const matches = Array.from(container.querySelectorAll('button')).filter(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one button "${label}", found ${matches.length}`);
  }
  return matches[0]!;
}

describe('EmailPreviewClient', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            variant: string;
            layout: string;
          };
          return Response.json({
            ok: true,
            variant: body.variant,
            layout: body.layout,
            recipient: 'jordan@sanctuarypergolas.co.nz',
            subject: `[Preview: ${body.layout}] Alex, we've received your pergola enquiry`,
            customerSubject: "Alex, we've received your pergola enquiry",
            preheader: 'Your project details and next steps from Sanctuary.',
            providerMessageId: 'preview-message-1',
          });
        }
        const variant = new URL(
          url,
          'http://localhost',
        ).searchParams.get('variant')!;
        return Response.json(previewResponse(variant));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('synchronizes all enquiry, viewport and theme controls across three layouts', async () => {
    const rendered = renderIntoDocument(<EmailPreviewClient />);
    await flushEffects();

    expect(
      button(rendered.container, 'Residential').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      button(rendered.container, 'Pitched').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      button(rendered.container, 'Without blinds').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(button(rendered.container, 'Desktop').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(button(rendered.container, 'Light').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(rendered.container.querySelectorAll('iframe')).toHaveLength(3);
    expect(rendered.container.textContent).toContain('Editorial Refined');
    expect(rendered.container.textContent).toContain('Image-led');
    expect(rendered.container.textContent).toContain('Compact');
    expect(rendered.container.textContent).toContain(
      'RESEND_API_KEY_PREVIEW',
    );
    expect(button(rendered.container, 'Send Editorial Refined').disabled).toBe(
      true,
    );

    await act(async () => {
      button(rendered.container, 'Dark').click();
      button(rendered.container, 'Mobile').click();
    });

    const comparison = rendered.container.querySelector(
      '[data-preview-viewport]',
    );
    expect(comparison?.getAttribute('data-preview-viewport')).toBe('mobile');
    expect(comparison?.getAttribute('data-preview-theme')).toBe('dark');
    expect(
      rendered.container.querySelector('iframe')?.getAttribute('srcdoc'),
    ).toContain('editorial-refined dark');

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
    ).toEqual(['Customer type', 'Viewport', 'Inbox theme']);

    rendered.unmount();
  });

  it('sends the selected layout only when the server reports ready', async () => {
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            variant: string;
            layout: string;
          };
          return Response.json({
            ok: true,
            variant: body.variant,
            layout: body.layout,
            recipient: 'jordan@sanctuarypergolas.co.nz',
            subject: `[Preview: ${body.layout}] Alex, we've received your pergola enquiry`,
            customerSubject: "Alex, we've received your pergola enquiry",
            providerMessageId: 'preview-message-1',
          });
        }
        const variant = new URL(
          String(input),
          'http://localhost',
        ).searchParams.get('variant')!;
        return Response.json(
          previewResponse(variant, { sendReady: true, reason: 'ready' }),
        );
      },
    );

    const rendered = renderIntoDocument(<EmailPreviewClient />);
    await flushEffects();

    const send = button(rendered.container, 'Send Image-led');
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
          layout: 'image-led',
        }),
      }),
    );
    expect(rendered.container.textContent).toContain(
      'Image-led sent to jordan@sanctuarypergolas.co.nz',
    );

    rendered.unmount();
  });
});
