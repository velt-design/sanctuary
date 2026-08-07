import { describe, expect, it } from 'vitest';
import { safePortalDocumentHref } from './portalDocumentNavigation';

describe('portal document navigation', () => {
  it('keeps same-site paths and rejects external or protocol-relative redirects', () => {
    expect(safePortalDocumentHref('/login?callbackUrl=%2Fdashboard')).toBe(
      '/login?callbackUrl=%2Fdashboard',
    );
    expect(safePortalDocumentHref('https://example.com/steal')).toBe('/login');
    expect(safePortalDocumentHref('//example.com/steal')).toBe('/login');
  });
});
