import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import DesignNextSteps from './DesignNextSteps';
import ProductFormComparison from '../products/ProductFormComparison';
import PergolaGuideNavigation from '../seo-landing/PergolaGuideNavigation';
import { getGuideDecisionLinks } from '../seo-landing/guideDecisionLinks';
import { pergolaGuides } from '../../data/pergolaGuides';
import { products } from '../../data/products';
import { pergolaCostConfig } from '../../app/pergola-cost-auckland/content';
import { designEnquiryHref, rememberConfiguratorSource } from '../configurator-prototype/configuratorOverlay';
vi.mock('../ConsentProvider', () => ({ useConsent: () => ({ consent: { analytics: false }, hasTrackingDecision: true }) }));

function render(element: React.ReactNode) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(element);
  return host;
}

describe('decision support journey boundaries', () => {
  it('returns product selections to their own handoff instead of opening an unrelated saved designer', () => {
    const host = render(<DesignNextSteps sourcePath="/products/pergolas/pitched" sourceProduct="pitched" selectionHref="#your-pitched-pergola" />);
    const links = Array.from(host.querySelectorAll('a'));
    expect(links[0].getAttribute('href')).toBe('#your-pitched-pergola');
    expect(links[0].textContent).toContain('Return to your design');
    expect(links[0].hasAttribute('data-journey-destination')).toBe(false);
    expect(links[1].getAttribute('href')).toContain('source_product=pitched');
    expect(links[1].getAttribute('href')).toContain('enquiry_intent=bespoke');
  });

  it('keeps product help context while opening the existing unseeded designer', () => {
    const host = render(<DesignNextSteps sourcePath="/products/pergolas/gable" sourceProduct="gable" />);
    const links = Array.from(host.querySelectorAll('a'));
    const design = new URL(links[0].getAttribute('href')!, 'https://example.test');
    expect(design.searchParams.get('configurator')).toBe('preview');
    expect(design.searchParams.get('source_product')).toBe('gable');
    const help = new URL(links[1].getAttribute('href')!, 'https://example.test');
    expect(help.pathname).toBe('/contact');
    expect(help.searchParams.get('source_path')).toBe('/products/pergolas/gable');
    expect(help.searchParams.get('source_product')).toBe('gable');
    expect(help.searchParams.get('enquiry_intent')).toBe('help');
    expect(host.textContent).toContain('some designs need an individual quote');
    expect(host.textContent).toContain('subject to site measure');
  });

  it('keeps cost-guide help in its existing contextual form and exposes the estimator', () => {
    const host = render(<DesignNextSteps sourcePath={pergolaCostConfig.route} helpHref="#project-details" />);
    expect(host.querySelector('a[href="#project-details"]')).not.toBeNull();
    rememberConfiguratorSource(pergolaCostConfig.hero.primaryHref);
    const enquiry = new URL(designEnquiryHref(), 'https://example.test');
    expect(enquiry.pathname).toBe('/design-enquiry');
    expect(enquiry.searchParams.get('source_path')).toBe('/pergola-cost-auckland');
    expect(enquiry.searchParams.get('source_component')).toBe('hero');
    sessionStorage.clear();
    expect(pergolaCostConfig.showDesignNextSteps).toBe(true);
  });

  it('compares the three featured pergola forms without promoting Hip', () => {
    const host = render(<ProductFormComparison />);
    const forms = products.filter(product => product.categorySlug === 'pergolas' && product.slug !== 'hip');
    expect(host.querySelectorAll('[role="rowheader"]')).toHaveLength(forms.length);
    for (const product of forms) expect(host.querySelector(`a[href="${product.route}"]`)).not.toBeNull();
    expect(host.querySelectorAll('[data-label="Check on your site"]')).toHaveLength(forms.length);
    expect(host.textContent).toContain('daylight separately from the form');
  });

  it('connects every existing guide to valid related decisions without a forced reading order', () => {
    const knownRoutes = new Set([...pergolaGuides.map(guide => guide.href), ...products.map(product => product.route), '/products', '/projects', '/architects-designers-builders', '/acrylic-roof-pergolas-auckland']);
    for (const guide of pergolaGuides) {
      const links = getGuideDecisionLinks(guide.href);
      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(knownRoutes.has(link.href)).toBe(true);
        expect(link.href).not.toBe(guide.href);
      }
      const host = render(<PergolaGuideNavigation route={guide.href} />);
      expect(host.querySelector('nav[aria-label="Related planning decisions"]')).not.toBeNull();
      expect(host.querySelector('[rel="next"], [rel="prev"]')).toBeNull();
      expect(host.textContent).not.toContain('of 10');
    }
    expect(getGuideDecisionLinks('/gable-pergolas-auckland')[0].href).toBe('/products/pergolas/gable');
  });
});
