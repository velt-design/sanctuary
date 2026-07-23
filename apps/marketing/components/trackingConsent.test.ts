import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shouldLoadGoogleTagManager } from './GoogleTagManager';

const here = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.resolve(here, relativePath), 'utf8');
}

describe('optional tracking consent boundaries', () => {
  it('does not load GTM before a stored explicit choice or when all optional categories are denied', () => {
    const denied = {
      analytics: false,
      marketing: false,
      updatedAt: new Date(0).toISOString(),
      version: 1 as const,
    };

    expect(shouldLoadGoogleTagManager(denied, false)).toBe(false);
    expect(shouldLoadGoogleTagManager(denied, true)).toBe(false);
    expect(shouldLoadGoogleTagManager({ ...denied, analytics: true }, true)).toBe(true);
    expect(shouldLoadGoogleTagManager({ ...denied, marketing: true }, true)).toBe(true);
    expect(shouldLoadGoogleTagManager({ ...denied, analytics: true, marketing: true }, true)).toBe(true);
  });

  it('keeps every optional vendor behind the consent provider and has no unconditional noscript request', () => {
    const layout = read('../app/layout.tsx');
    const gtm = read('GoogleTagManager.tsx');
    const analytics = read('Analytics.tsx');
    const meta = read('MetaPixel.tsx');
    const archipro = read('ArchiproPixel.tsx');

    const providerStart = layout.indexOf('<ConsentProvider>');
    expect(providerStart).toBeGreaterThan(-1);
    for (const component of ['<GoogleTagManager />', '<Analytics />', '<MetaPixel />', '<ArchiproPixel />']) {
      expect(layout.indexOf(component)).toBeGreaterThan(providerStart);
    }

    expect(gtm).not.toContain('<noscript>');
    expect(gtm).not.toContain('beforeInteractive');
    expect(analytics).toContain('if (!consent.analytics');
    expect(meta).toContain('if (!consent.marketing');
    expect(archipro).toContain('if (!consent.marketing');
  });

  it('does not reset GA consent to denied after the user has granted analytics', () => {
    const runtimeGa = read('../app/runtime-ga.js/route.ts');
    expect(runtimeGa).not.toContain("window.gtag('consent', 'default'");
  });

  it('emits non-PII enquiry conversion events only after an explicit relevant choice', () => {
    const contact = read('../app/contact/page.tsx');
    const acrylicForm = read('../app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm.tsx');
    expect(contact).toContain('hasStoredChoice && consent.analytics');
    expect(contact).toContain('hasStoredChoice && consent.marketing');
    expect(acrylicForm).toContain('if (!trackingConsent.hasStoredChoice) return');
    expect(acrylicForm).toContain('if (trackingConsent.analytics)');
    expect(acrylicForm).toContain('if (trackingConsent.marketing)');
  });
});
