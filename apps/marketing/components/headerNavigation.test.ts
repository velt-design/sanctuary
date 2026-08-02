import { describe, expect, it } from 'vitest';
import { getCanonicalMarketingPathname } from '@/lib/enquiryContext';
import {
  getDesktopHeaderNavigation,
  getMobileHeaderNavigation,
  isHeaderHeroOverlayPath,
  shouldShowDesktopHeaderCta,
} from './headerNavigation';

describe('shared header navigation model', () => {
  it('canonicalizes the production static root alias without changing real routes', () => {
    expect(getCanonicalMarketingPathname(null)).toBe('/');
    expect(getCanonicalMarketingPathname('/index')).toBe('/');
    expect(getCanonicalMarketingPathname('/products/pergolas/gable')).toBe(
      '/products/pergolas/gable',
    );
  });

  it('exposes four desktop pathways around a two-item centre split', () => {
    expect(getDesktopHeaderNavigation('/').map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Projects', href: '/projects' },
      { label: 'Products', href: '/products' },
      { label: 'Commercial', href: '/commercial-pergolas-auckland' },
      {
        label: 'Professionals',
        href: '/architects-designers-builders',
      },
    ]);
  });

  it('keeps the production project opening within the shared hero treatment', () => {
    expect(isHeaderHeroOverlayPath('/')).toBe(true);
    expect(isHeaderHeroOverlayPath('/home-guided')).toBe(true);
    expect(isHeaderHeroOverlayPath('/home-project-finder')).toBe(false);
    expect(isHeaderHeroOverlayPath('/home-experimental')).toBe(false);
    expect(isHeaderHeroOverlayPath('/home-v2')).toBe(false);
    expect(isHeaderHeroOverlayPath('/contact')).toBe(false);
  });

  it('suppresses only the guided route desktop CTA', () => {
    expect(shouldShowDesktopHeaderCta('/home-guided')).toBe(false);
    expect(shouldShowDesktopHeaderCta('/')).toBe(true);
    expect(shouldShowDesktopHeaderCta('/commercial-pergolas-auckland')).toBe(true);
  });

  it('clarifies product discovery and exposes the approved mobile pathways', () => {
    expect(getMobileHeaderNavigation('/projects').map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Projects', href: '/projects' },
      { label: 'Pergola options', href: '/products' },
      { label: 'Commercial', href: '/commercial-pergolas-auckland' },
      {
        label: 'Professionals',
        href: '/architects-designers-builders',
      },
    ]);
  });

  it('sends professional visitors to the capability route', () => {
    const professional = getMobileHeaderNavigation('/products/pergolas/gable')
      .find((item) => item.id === 'professional');

    expect(professional?.href).toBe(
      '/architects-designers-builders',
    );
  });

  it('marks the relevant destination current on nested and audience routes', () => {
    expect(getMobileHeaderNavigation('/projects/warkworth-outdoor-room')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['projects']);
    expect(getMobileHeaderNavigation('/products/pergolas/pitched')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['products']);
    expect(getMobileHeaderNavigation('/commercial-pergolas-auckland')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['commercial']);
    expect(getMobileHeaderNavigation('/architects-designers-builders')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['professional']);
    expect(getDesktopHeaderNavigation('/commercial-pergolas-auckland')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['commercial']);
    expect(getDesktopHeaderNavigation('/architects-designers-builders')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['professional']);
    expect(getMobileHeaderNavigation('/contact')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual([]);
  });
});
