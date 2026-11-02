import { describe, expect, it, vi } from 'vitest';

// Vitest's marketing alias is narrower than the Portal bridge used by this renderer.
vi.mock('@/lib/sharedEmails', () => import('../sharedEmails'));

import { renderWebsiteAutoresponderPreviewPayload } from './websiteAutoresponderPreviewRenderer';
import { getWebsiteAutoresponderPreviewFixture, renderWebsiteAutoresponder } from '../sharedEmails';

describe('website autoresponder preview HTML', () => {
  it.each(['experience-configured', 'professional'] as const)('keeps the exact sent light HTML in both inbox surrounds for %s', async variant => {
    const fixture = getWebsiteAutoresponderPreviewFixture(variant);
    const sent = await renderWebsiteAutoresponder(fixture.templateId, fixture.variables as unknown as Record<string, unknown>);
    const preview = await renderWebsiteAutoresponderPreviewPayload(variant);
    const active = preview.layouts.find(layout => layout.id === 'editorial-refined')!;
    expect(active.htmlLight).toBe(sent.html);
    expect(active.htmlDark).toBe(sent.html);
    expect(active.text).toBe(sent.text);
    expect(active.subject).toBe(sent.subject);
    for (const layout of preview.layouts) {
      expect(layout.htmlDark).toBe(layout.htmlLight);
      expect(layout.htmlLight).not.toContain('prefers-color-scheme: dark');
    }
  });
});
