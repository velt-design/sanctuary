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
    image: {
      projectSlug: 'warkworth-outdoor-room',
      projectTitle: 'Warkworth Outdoor Room',
      projectHref:
        'https://www.sanctuarypergolas.co.nz/projects/warkworth-outdoor-room',
      imageUrl:
        'https://www.sanctuarypergolas.co.nz/images/project-warkworth-outdoor-room-07.jpg',
      imageAlt: 'Warkworth outdoor room',
      location: 'Warkworth',
      roofApproach: 'Mixed acrylic and timber-lined roof',
      match: 'exact',
    },
    recipient: 'jordan@sanctuarypergolas.co.nz',
    environment: 'Vercel Preview',
    deliveryMode: 'Preview-only Resend · exact fixture · no writes',
    sendReady: options.sendReady ?? false,
    configurationReason: options.reason ?? 'missing_api_key',
  };
}

function successfulSend(variant: string, layout: string) {
  return {
    ok: true,
    variant,
    layout,
    recipient: 'jordan@sanctuarypergolas.co.nz',
    subject: `[Preview: ${layout}] Alex, we've received your pergola enquiry`,
    customerSubject: "Alex, we've received your pergola enquiry",
    preheader: 'Your project details and next steps from Sanctuary.',
    providerMessageId: `preview-message-${layout}`,
  };
}

async function flushEffects(steps = 5) {
  await act(async () => {
    for (let index = 0; index < steps; index += 1) {
      await Promise.resolve();
    }
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

function segment(container: HTMLElement, value: string): HTMLButtonElement {
  const control = container.querySelector<HTMLButtonElement>(
    `[data-segment-value="${value}"]`,
  );
  if (!control) throw new Error(`Missing segment ${value}`);
  return control;
}

function layoutChoice(
  container: HTMLElement,
  layout: string,
): HTMLButtonElement {
  const control = container.querySelector<HTMLButtonElement>(
    `[data-layout-choice="${layout}"]`,
  );
  if (!control) throw new Error(`Missing layout choice ${layout}`);
  return control;
}

function select(
  container: HTMLElement,
  labelText: string,
): HTMLSelectElement {
  const label = Array.from(container.querySelectorAll('label')).find(
    (candidate) => candidate.textContent?.trim() === labelText,
  );
  if (!label?.htmlFor) throw new Error(`Missing select label ${labelText}`);
  const control = container.querySelector<HTMLSelectElement>(
    `#${label.htmlFor}`,
  );
  if (!control) throw new Error(`Missing select ${labelText}`);
  return control;
}

async function choose(
  container: HTMLElement,
  label: string,
  value: string,
) {
  await act(async () => {
    const control = select(container, label);
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
  await flushEffects();
}

function postCalls() {
  return vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
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
          return Response.json(successfulSend(body.variant, body.layout));
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

  it('provides synchronized fixture, comparison, focus, viewport, theme, zoom and reset controls', async () => {
    const rendered = renderIntoDocument(<EmailPreviewClient />);
    expect(rendered.container.textContent).toContain(
      'Rendering the workbench',
    );
    await flushEffects();

    expect(select(rendered.container, 'Customer type').value).toBe('residential');
    expect(select(rendered.container, 'Roof form').value).toBe('pitched');
    expect(select(rendered.container, 'Outdoor blinds').value).toBe(
      'without-blinds',
    );
    expect(segment(rendered.container, 'compare').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(segment(rendered.container, 'desktop').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(segment(rendered.container, 'light').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(segment(rendered.container, '50').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(rendered.container.querySelectorAll('iframe')).toHaveLength(3);
    expect(rendered.container.textContent).toContain('Example 01 of 17');
    expect(rendered.container.textContent).toContain('Warkworth Outdoor Room');
    expect(rendered.container.textContent).toContain('Vercel Preview');
    expect(rendered.container.textContent).toContain(
      'fixed recipient · no BCC · no database or audit writes',
    );
    expect(rendered.container.textContent).toContain(
      'RESEND_API_KEY_PREVIEW',
    );
    expect(button(rendered.container, 'Send Editorial Refined').disabled).toBe(
      true,
    );
    expect(button(rendered.container, 'Send all 3').disabled).toBe(true);

    await act(async () => {
      segment(rendered.container, 'dark').click();
      segment(rendered.container, 'mobile').click();
      segment(rendered.container, '75').click();
      segment(rendered.container, 'focus').click();
    });

    const canvas = rendered.container.querySelector(
      '[data-testid="email-preview-canvas"]',
    );
    expect(canvas?.getAttribute('data-preview-mode')).toBe('focus');
    expect(canvas?.getAttribute('data-preview-viewport')).toBe('mobile');
    expect(canvas?.getAttribute('data-preview-theme')).toBe('dark');
    expect(rendered.container.querySelectorAll('iframe')).toHaveLength(1);
    expect(
      rendered.container.querySelector('iframe')?.getAttribute('srcdoc'),
    ).toContain('editorial-refined dark');
    const focusedCard = rendered.container.querySelector<HTMLElement>(
      '[data-layout-id="editorial-refined"]',
    );
    expect(focusedCard?.style.getPropertyValue('--preview-frame-width')).toBe(
      '390px',
    );
    expect(focusedCard?.style.getPropertyValue('--preview-frame-scale')).toBe(
      '0.75',
    );

    await act(async () => {
      layoutChoice(rendered.container, 'image-led').click();
    });
    expect(rendered.container.querySelectorAll('iframe')).toHaveLength(1);
    expect(
      rendered.container.querySelector('iframe')?.getAttribute('title'),
    ).toContain('Image-led');
    expect(layoutChoice(rendered.container, 'image-led').getAttribute('aria-pressed')).toBe(
      'true',
    );

    await choose(rendered.container, 'Customer type', 'commercial');
    await choose(rendered.container, 'Roof form', 'gable');
    await choose(rendered.container, 'Outdoor blinds', 'with-blinds');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/staff/v1/email-previews/website-autoresponder?variant=commercial-gable-with-blinds',
      expect.objectContaining({ cache: 'no-store' }),
    );

    await choose(rendered.container, 'Customer type', 'professional');
    expect(rendered.container.textContent).toContain(
      'Professional uses the fixed KiwiRail Head Office reference',
    );
    expect(rendered.container.querySelectorAll('select')).toHaveLength(1);

    await act(async () => {
      button(rendered.container, 'Reset').click();
      await Promise.resolve();
    });
    await flushEffects();
    expect(select(rendered.container, 'Customer type').value).toBe('residential');
    expect(select(rendered.container, 'Roof form').value).toBe('pitched');
    expect(segment(rendered.container, 'compare').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(segment(rendered.container, '50').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(rendered.container.querySelectorAll('iframe')).toHaveLength(3);

    rendered.unmount();
  });

  it('explains rendering failures and lets staff retry', async () => {
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      attempts += 1;
      if (attempts === 1) {
        return Response.json(
          { error: 'The preview renderer is temporarily unavailable.' },
          { status: 503 },
        );
      }
      const variant = new URL(
        String(input),
        'http://localhost',
      ).searchParams.get('variant')!;
      return Response.json(previewResponse(variant));
    });

    const rendered = renderIntoDocument(<EmailPreviewClient />);
    await flushEffects();

    expect(rendered.container.textContent).toContain(
      'Preview rendering failed',
    );
    expect(rendered.container.textContent).toContain(
      'The preview renderer is temporarily unavailable.',
    );

    await act(async () => {
      button(rendered.container, 'Try again').click();
      await Promise.resolve();
    });
    await flushEffects();

    expect(attempts).toBe(2);
    expect(rendered.container.textContent).not.toContain(
      'Preview rendering failed',
    );
    expect(rendered.container.querySelectorAll('iframe')).toHaveLength(3);

    rendered.unmount();
  });

  it('rejects a mismatched preview response instead of showing stale scenario content', async () => {
    vi.mocked(fetch).mockImplementation(async () => Response.json(
      previewResponse('professional'),
    ));

    const rendered = renderIntoDocument(<EmailPreviewClient />);
    await flushEffects();

    expect(rendered.container.textContent).toContain('Preview rendering failed');
    expect(rendered.container.textContent).toContain(
      'The preview response did not match the selected enquiry.',
    );
    expect(rendered.container.querySelectorAll('iframe')).toHaveLength(0);
    rendered.unmount();
  });

  it('requires confirmation and sends only the active layout', async () => {
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            variant: string;
            layout: string;
          };
          return Response.json(successfulSend(body.variant, body.layout));
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
    await act(async () => {
      layoutChoice(rendered.container, 'image-led').click();
    });

    await act(async () => {
      button(rendered.container, 'Send Image-led').click();
    });
    expect(postCalls()).toHaveLength(0);
    expect(rendered.container.textContent).toContain('Send Image-led?');
    expect(document.activeElement).toBe(button(rendered.container, 'Cancel'));
    expect(rendered.container.textContent).toContain(
      'for residential pitched without blinds to',
    );

    await act(async () => {
      button(rendered.container, 'Cancel').click();
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(
      button(rendered.container, 'Send Image-led'),
    );

    await act(async () => {
      button(rendered.container, 'Send Image-led').click();
    });

    await act(async () => {
      button(rendered.container, 'Confirm send').click();
      await Promise.resolve();
    });
    await flushEffects(8);

    expect(postCalls()).toHaveLength(1);
    expect(postCalls()[0]?.[1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String(postCalls()[0]?.[1]?.body))).toEqual({
      variant: 'residential-pitched-without-blinds',
      layout: 'image-led',
      clientIntentId: expect.stringMatching(/^email-preview_/),
    });
    expect(rendered.container.textContent).toContain('Image-led accepted');
    expect(rendered.container.textContent).toContain(
      'jordan@sanctuarypergolas.co.nz',
    );

    rendered.unmount();
  });

  it('confirms and sends all three exact layouts sequentially', async () => {
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            variant: string;
            layout: string;
          };
          return Response.json(successfulSend(body.variant, body.layout));
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
    await act(async () => {
      button(rendered.container, 'Send all 3').click();
    });
    expect(rendered.container.textContent).toContain('Send all 3 alternatives?');
    expect(postCalls()).toHaveLength(0);

    await act(async () => {
      button(rendered.container, 'Confirm send').click();
      await Promise.resolve();
    });
    await flushEffects(12);

    expect(
      postCalls().map(([, init]) => JSON.parse(String(init?.body)).layout),
    ).toEqual(['editorial-refined', 'image-led', 'compact']);
    expect(rendered.container.textContent).toContain('3 alternatives accepted');

    rendered.unmount();
  });

  it('stops a batch after failure and offers a focused retry', async () => {
    let imageLedFailures = 1;
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            variant: string;
            layout: string;
          };
          if (body.layout === 'image-led' && imageLedFailures > 0) {
            imageLedFailures -= 1;
            return Response.json(
              { error: 'Provider temporarily unavailable.' },
              { status: 502 },
            );
          }
          return Response.json(successfulSend(body.variant, body.layout));
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
    await act(async () => {
      button(rendered.container, 'Send all 3').click();
      await Promise.resolve();
    });
    await act(async () => {
      button(rendered.container, 'Confirm send').click();
      await Promise.resolve();
    });
    await flushEffects(10);

    expect(postCalls()).toHaveLength(2);
    expect(rendered.container.textContent).toContain(
      '1 accepted before the failure',
    );
    expect(rendered.container.textContent).toContain(
      'Image-led failed. Provider temporarily unavailable.',
    );

    await act(async () => {
      button(rendered.container, 'Retry failed').click();
      await Promise.resolve();
    });
    await flushEffects(8);
    expect(postCalls()).toHaveLength(3);
    expect(JSON.parse(String(postCalls()[2]?.[1]?.body)).layout).toBe(
      'image-led',
    );
    expect(rendered.container.textContent).toContain('Image-led accepted');

    rendered.unmount();
  });
});
