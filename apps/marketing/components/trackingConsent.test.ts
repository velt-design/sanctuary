import { existsSync, readFileSync } from 'node:fs';
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
    const webVitals = read('WebVitals.tsx');
    const meta = read('MetaPixel.tsx');
    const archipro = read('ArchiproPixel.tsx');

    const providerStart = layout.indexOf('<ConsentProvider>');
    expect(providerStart).toBeGreaterThan(-1);
    for (const component of ['<GoogleTagManager />', '<MetaPixel />', '<ArchiproPixel />']) {
      expect(layout.indexOf(component)).toBeGreaterThan(providerStart);
    }

    expect(layout).not.toContain('<Analytics />');
    expect(existsSync(path.resolve(here, '../app/runtime-ga.js/route.ts'))).toBe(false);
    expect(gtm).not.toContain('<noscript>');
    expect(gtm).not.toContain('beforeInteractive');
    expect(webVitals).toContain('if (!consent.analytics');
    expect(webVitals).not.toContain('NEXT_PUBLIC_GA_MEASUREMENT_ID');
    expect(meta).toContain('if (!consent.marketing');
    expect(archipro).toContain('if (!consent.marketing');
  });

  it('uses GTM as the only Google runtime loader', () => {
    const layout = read('../app/layout.tsx');
    const gtm = read('GoogleTagManager.tsx');
    expect(layout).toContain('<GoogleTagManager />');
    expect(layout).not.toContain('Analytics');
    expect(gtm).toContain('googletagmanager.com/gtm.js');
    expect(gtm).not.toContain('googletagmanager.com/gtag/js');
  });

  it('allows the GTM resources reported by container diagnostics through CSP', () => {
    const nextConfig = read('../next.config.ts');
    expect(nextConfig.match(/https:\/\/www\.googletagmanager\.com/g)).toHaveLength(6);
    expect(nextConfig.match(/https:\/\/ad\.doubleclick\.net/g)).toHaveLength(2);
  });

  it('emits non-PII enquiry conversion events only after an explicit relevant choice', () => {
    const contact = read('../app/contact/ContactEnquiryForm.tsx');
    const acrylicForm = read('../app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm.tsx');
    expect(contact).toMatch(/hasStoredChoice\s*&&\s*consent\.analytics/);
    expect(contact).toMatch(/hasStoredChoice\s*&&\s*consent\.marketing/);
    expect(acrylicForm).toContain('if (!trackingConsent.hasStoredChoice) return');
    expect(acrylicForm).toContain('if (trackingConsent.analytics)');
    expect(acrylicForm).toContain('if (trackingConsent.marketing)');
  });
});
