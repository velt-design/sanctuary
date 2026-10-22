import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Page, { metadata } from './page';
import { guideHubItems, planningTopics, servicePaths } from './content';
import { pergolaGuides } from '../../data/pergolaGuides';
import { parseEnquiryContext } from '../../lib/enquiryContext';
import { getInitialContactPathway } from '../contact/contactJourney';

function render() { const el = document.createElement('div'); el.innerHTML = renderToStaticMarkup(Page()); return el; }

describe('photographic guide hub', () => {
  it('retains every existing destination once, with services separate from guides', () => {
    const page = render();
    const guides = [...page.querySelectorAll('[data-guide-link]')].map(a => a.getAttribute('href'));
    const services = [...page.querySelectorAll('[data-service-link]')].map(a => a.getAttribute('href'));
    expect(guides).toEqual(guideHubItems.map(g => g.href));
    expect(services).toEqual(servicePaths.map(s => s.href));
    expect([...guides, ...services].sort()).toEqual(pergolaGuides.map(g => g.href).sort());
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.textContent).not.toContain('Editorial review:');
  });

  it('keeps cost, room, blinds and external roof comparison before form choices', () => {
    expect(planningTopics.map(t => t.href)).toEqual(['/pergola-cost-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs']);
    const comparison = render().querySelector('[href="/acrylic-pergolas-vs-louvre-roofs"]');
    expect(comparison?.textContent).toContain('Sanctuary does not supply louvre roofs.');
  });

  it('uses existing actual topic photographs, including a visibly lowered blind', () => {
    expect(new Set(guideHubItems.map(g => g.image)).size).toBe(7);
    for (const item of guideHubItems) expect(existsSync(resolve('apps/marketing/public', item.image.slice(1))), item.image).toBe(true);
    expect(guideHubItems.find(g => g.href === '/pergolas-with-blinds')?.image).toBe('/images/blind-coastal-mesh.webp');
    expect(render().querySelectorAll('[data-guide-card] img')).toHaveLength(7);
  });

  it('keeps canonical collection metadata and lists only the visible seven guides', () => {
    expect(metadata.alternates?.canonical).toBe('/pergola-guides');
    expect(metadata.title).toEqual({ absolute: 'Pergola Design Guides | Sanctuary Pergolas' });
    const schema = [...render().querySelectorAll('script[type="application/ld+json"]')].flatMap(s => JSON.parse(s.textContent!));
    expect(schema.find(s => s['@type'] === 'CollectionPage')?.url).toBe('https://www.sanctuarypergolas.co.nz/pergola-guides');
    const list = schema.find(s => s['@type'] === 'ItemList');
    expect(list.numberOfItems).toBe(7);
    expect(list.itemListElement.map((i: { url: string }) => new URL(i.url).pathname)).toEqual(guideHubItems.map(g => g.href));
  });

  it('takes both undecided enquiry actions into the existing help brief with source context', () => {
    const links = [...render().querySelectorAll('a[href^="/contact?"]')];
    expect(links).toHaveLength(2);
    for (const [index, link] of links.entries()) {
      const url = new URL(link.getAttribute('href')!, 'https://example.invalid');
      expect(url.hash).toBe('#contact-form');
      expect(url.searchParams.get('enquiry_intent')).toBe('help');
      const context = parseEnquiryContext(Object.fromEntries(url.searchParams));
      expect(context).toMatchObject({ sourcePath: '/pergola-guides', sourceComponent: index ? 'final_cta' : 'hero' });
      expect(getInitialContactPathway(null, context, 'help')).toBe('help');
    }
  });
});
